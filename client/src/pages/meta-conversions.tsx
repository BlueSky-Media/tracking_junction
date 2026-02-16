import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Upload, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  Mail, Phone, Globe, Fingerprint, MousePointerClick, Clock, History,
  ArrowUpDown, Loader2, Info, Shield, ChevronLeft, ChevronsLeft, ChevronsRight,
  Users, UserCheck, UserX, DollarSign, TrendingUp, Plus, Pencil, Trash2,
  Lock, Unlock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { SiFacebook } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface CapiStatus {
  configured: boolean;
  hasPixelId: boolean;
  hasAccessToken: boolean;
}

interface CapiEvent {
  id: number;
  sessionId: string;
  eventId: string;
  eventTimestamp: string;
  page: string;
  domain: string;
  hasFirstName: boolean;
  hasLastName: boolean;
  nameInitials: string | null;
  maskedEmail: string | null;
  maskedPhone: string | null;
  adId: string | null;
  adName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  fbclid: boolean;
  fbp: boolean;
  fbc: boolean;
  externalId: boolean;
  ipAddress: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
  uploaded: boolean;
  uploadStatus: "sent" | "synced" | "pending";
  geoState: string | null;
  deviceType: string | null;
  placement: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  utmId: string | null;
}

interface MissingResult {
  events: CapiEvent[];
  total: number;
  uploaded: number;
  synced: number;
}

interface ComparisonRow {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  ourLeads: number;
  metaLeads: number;
  difference: number;
}

interface ComparisonResult {
  comparison: ComparisonRow[];
}

interface UploadResult {
  results: { eventId: number; status: string; message?: string }[];
  sent: number;
  received: number;
  testMode: boolean;
  testEventCode?: string;
  pixelId?: string;
}

interface HistoryEntry {
  id: number;
  eventCount: number;
  sentAt: string;
  testMode: boolean;
  sent: number;
  received: number;
  status: string;
}

interface HistoryResult {
  history: HistoryEntry[];
}

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  business_name?: string;
}

interface SignalRuleConditions {
  audience?: string[];
  domain?: string[];
  deviceType?: string[];
  pageType?: string[];
  stepName?: string[];
  stepNumber?: number[];
  minTimeOnStep?: number;
  maxTimeOnStep?: number;
  minBudget?: number;
  maxBudget?: number;
  hasEmail?: boolean;
  hasPhone?: boolean;
}

interface SignalRule {
  id: number;
  name: string;
  triggerEvent: string;
  conditions: SignalRuleConditions;
  metaEventName: string;
  customValue: number | null;
  currency: string | null;
  contentName: string | null;
  active: number;
  createdAt: string;
  updatedAt: string;
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

function truncateSession(sessionId: string): string {
  if (sessionId.length <= 12) return sessionId;
  return sessionId.slice(0, 8) + "...";
}

function SignalIcon({ active, icon: Icon, label }: { active: boolean; icon: any; label: string }) {
  return (
    <span
      title={label}
      className={`inline-flex items-center justify-center w-4 h-4 rounded-sm ${active ? "text-primary" : "text-muted-foreground/30"}`}
    >
      <Icon className="w-3 h-3" />
    </span>
  );
}

export default function MetaConversionsPage() {
  const defaults = getDefaultDates();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<"events" | "audiences">("events");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [audience, setAudience] = useState("__all__");
  const [adIdFilter, setAdIdFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [audiencePage, setAudiencePage] = useState(1);
  const [audienceTierFilter, setAudienceTierFilter] = useState("__all__");

  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleTriggerEvent, setRuleTriggerEvent] = useState("page_land");
  const [ruleMetaEventName, setRuleMetaEventName] = useState("");
  const [ruleCustomValue, setRuleCustomValue] = useState("");
  const [ruleCurrency, setRuleCurrency] = useState("USD");
  const [ruleContentName, setRuleContentName] = useState("");
  const [ruleCondAudience, setRuleCondAudience] = useState<string[]>([]);
  const [ruleCondDomain, setRuleCondDomain] = useState<string[]>([]);
  const [ruleCondDeviceType, setRuleCondDeviceType] = useState<string[]>([]);
  const [ruleCondPageType, setRuleCondPageType] = useState<string[]>([]);
  const [ruleCondMinTime, setRuleCondMinTime] = useState("");
  const [ruleCondMaxTime, setRuleCondMaxTime] = useState("");
  const [ruleCondStepName, setRuleCondStepName] = useState("");
  const [ruleCondStepNumber, setRuleCondStepNumber] = useState("");
  const [ruleCondMinBudget, setRuleCondMinBudget] = useState("");
  const [ruleCondMaxBudget, setRuleCondMaxBudget] = useState("");
  const [ruleCondHasEmail, setRuleCondHasEmail] = useState(false);
  const [ruleCondHasPhone, setRuleCondHasPhone] = useState(false);
  const [lockedRules, setLockedRules] = useState<Set<number>>(new Set());

  const statusQuery = useQuery<CapiStatus>({
    queryKey: ["/api/meta-conversions/status"],
  });

  const eventsQuery = useQuery<MissingResult>({
    queryKey: ["/api/meta-conversions/missing", startDate, endDate, adIdFilter, audience, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (adIdFilter) params.set("adId", adIdFilter);
      if (audience && audience !== "__all__") params.set("audience", audience);
      params.set("page", page.toString());
      const res = await fetch(`/api/meta-conversions/missing?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const accountsQuery = useQuery<AdAccount[]>({
    queryKey: ["/api/facebook/ad-accounts"],
  });

  const comparisonQuery = useQuery<ComparisonResult>({
    queryKey: ["/api/meta-conversions/comparison", startDate, endDate, selectedAdAccount],
    enabled: comparisonOpen && !!selectedAdAccount,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("adAccountId", selectedAdAccount);
      const res = await fetch(`/api/meta-conversions/comparison?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const historyQuery = useQuery<HistoryResult>({
    queryKey: ["/api/meta-conversions/history"],
    enabled: historyOpen,
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: { eventIds: number[] }) => {
      const res = await apiRequest("POST", "/api/meta-conversions/upload", payload);
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: (data) => {
      toast({
        title: `Upload complete: ${data.received}/${data.sent} events processed`,
        description: `Sent to pixel: ${data.pixelId}`,
      });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/missing"] });
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/history"] });
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/comparison"] });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (payload: { eventIds: number[] }) => {
      const res = await apiRequest("POST", "/api/meta-conversions/mark-synced", payload);
      return res.json() as Promise<{ marked: number; total: number }>;
    },
    onSuccess: (data) => {
      toast({ title: `Marked ${data.marked} events as synced` });
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/missing"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to mark as synced", description: err.message, variant: "destructive" });
    },
  });

  const signalRulesQuery = useQuery<{ rules: SignalRule[] }>({
    queryKey: ["/api/meta-conversions/signal-rules"],
  });

  const lockedInitialized = useRef(false);
  useEffect(() => {
    if (!lockedInitialized.current && signalRulesQuery.data?.rules?.length) {
      setLockedRules(new Set(signalRulesQuery.data.rules.map(r => r.id)));
      lockedInitialized.current = true;
    }
  }, [signalRulesQuery.data]);

  const resetRuleForm = () => {
    setRuleName("");
    setRuleTriggerEvent("page_land");
    setRuleMetaEventName("");
    setRuleCustomValue("");
    setRuleCurrency("USD");
    setRuleContentName("");
    setRuleCondAudience([]);
    setRuleCondDomain([]);
    setRuleCondDeviceType([]);
    setRuleCondPageType([]);
    setRuleCondMinTime("");
    setRuleCondMaxTime("");
    setRuleCondStepName("");
    setRuleCondStepNumber("");
    setRuleCondMinBudget("");
    setRuleCondMaxBudget("");
    setRuleCondHasEmail(false);
    setRuleCondHasPhone(false);
  };

  const populateRuleForm = (rule: SignalRule) => {
    setRuleName(rule.name);
    setRuleTriggerEvent(rule.triggerEvent);
    setRuleMetaEventName(rule.metaEventName);
    setRuleCustomValue(rule.customValue != null ? String(rule.customValue) : "");
    setRuleCurrency(rule.currency || "USD");
    setRuleContentName(rule.contentName || "");
    setRuleCondAudience(rule.conditions.audience || []);
    setRuleCondDomain(rule.conditions.domain || []);
    setRuleCondDeviceType(rule.conditions.deviceType || []);
    setRuleCondPageType(rule.conditions.pageType || []);
    setRuleCondMinTime(rule.conditions.minTimeOnStep != null ? String(rule.conditions.minTimeOnStep) : "");
    setRuleCondMaxTime(rule.conditions.maxTimeOnStep != null ? String(rule.conditions.maxTimeOnStep) : "");
    setRuleCondStepName(rule.conditions.stepName ? rule.conditions.stepName.join(", ") : "");
    setRuleCondStepNumber(rule.conditions.stepNumber ? rule.conditions.stepNumber.join(", ") : "");
    setRuleCondMinBudget(rule.conditions.minBudget != null ? String(rule.conditions.minBudget) : "");
    setRuleCondMaxBudget(rule.conditions.maxBudget != null ? String(rule.conditions.maxBudget) : "");
    setRuleCondHasEmail(rule.conditions.hasEmail || false);
    setRuleCondHasPhone(rule.conditions.hasPhone || false);
  };

  const buildRulePayload = () => {
    const conditions: SignalRuleConditions = {};
    if (ruleCondAudience.length > 0) conditions.audience = ruleCondAudience;
    if (ruleCondDomain.length > 0) conditions.domain = ruleCondDomain;
    if (ruleCondDeviceType.length > 0) conditions.deviceType = ruleCondDeviceType;
    if (ruleCondPageType.length > 0) conditions.pageType = ruleCondPageType;
    if (ruleCondMinTime) conditions.minTimeOnStep = Number(ruleCondMinTime);
    if (ruleCondMaxTime) conditions.maxTimeOnStep = Number(ruleCondMaxTime);
    if (ruleCondStepName.trim()) conditions.stepName = ruleCondStepName.split(",").map(s => s.trim()).filter(Boolean);
    if (ruleCondStepNumber.trim()) conditions.stepNumber = ruleCondStepNumber.split(",").map(s => Number(s.trim())).filter(n => !isNaN(n));
    if (ruleCondMinBudget) conditions.minBudget = Number(ruleCondMinBudget);
    if (ruleCondMaxBudget) conditions.maxBudget = Number(ruleCondMaxBudget);
    if (ruleCondHasEmail) conditions.hasEmail = true;
    if (ruleCondHasPhone) conditions.hasPhone = true;
    return {
      name: ruleName,
      triggerEvent: ruleTriggerEvent,
      metaEventName: ruleMetaEventName,
      customValue: ruleCustomValue ? Number(ruleCustomValue) : null,
      currency: ruleCurrency || null,
      contentName: ruleContentName || null,
      conditions,
    };
  };

  const createRuleMutation = useMutation({
    mutationFn: async (payload: ReturnType<typeof buildRulePayload>) => {
      const res = await apiRequest("POST", "/api/meta-conversions/signal-rules", payload);
      return res.json() as Promise<{ rule: SignalRule }>;
    },
    onSuccess: () => {
      toast({ title: "Signal rule created" });
      setNewRuleOpen(false);
      resetRuleForm();
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/signal-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create rule", description: err.message, variant: "destructive" });
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ id, ...payload }: ReturnType<typeof buildRulePayload> & { id: number; active?: number }) => {
      const res = await apiRequest("PUT", `/api/meta-conversions/signal-rules/${id}`, payload);
      return res.json() as Promise<{ rule: SignalRule }>;
    },
    onSuccess: () => {
      toast({ title: "Signal rule updated" });
      setEditingRuleId(null);
      resetRuleForm();
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/signal-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to update rule", description: err.message, variant: "destructive" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/meta-conversions/signal-rules/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Signal rule deleted" });
      qc.invalidateQueries({ queryKey: ["/api/meta-conversions/signal-rules"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete rule", description: err.message, variant: "destructive" });
    },
  });

  const toggleRuleActive = (rule: SignalRule) => {
    updateRuleMutation.mutate({
      id: rule.id,
      name: rule.name,
      triggerEvent: rule.triggerEvent,
      metaEventName: rule.metaEventName,
      customValue: rule.customValue,
      currency: rule.currency,
      contentName: rule.contentName,
      conditions: rule.conditions,
      active: rule.active === 1 ? 0 : 1,
    });
  };

  const isRuleLocked = (ruleId: number) => lockedRules.has(ruleId);

  const toggleRuleLock = (ruleId: number) => {
    setLockedRules(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
        if (editingRuleId === ruleId) {
          setEditingRuleId(null);
          resetRuleForm();
        }
      }
      return next;
    });
  };

  const toggleConditionArray = (arr: string[], value: string, setter: (v: string[]) => void) => {
    if (arr.includes(value)) {
      setter(arr.filter(v => v !== value));
    } else {
      setter([...arr, value]);
    }
  };

  const summarizeConditions = (c: SignalRuleConditions): string => {
    const parts: string[] = [];
    if (c.audience?.length) parts.push(`Audience: ${c.audience.join(", ")}`);
    if (c.domain?.length) parts.push(`Domain: ${c.domain.join(", ")}`);
    if (c.deviceType?.length) parts.push(`Device: ${c.deviceType.join(", ")}`);
    if (c.pageType?.length) parts.push(`Type: ${c.pageType.join(", ")}`);
    if (c.stepName?.length) parts.push(`Step: ${c.stepName.join(", ")}`);
    if (c.stepNumber?.length) parts.push(`Step #${c.stepNumber.join(", ")}`);
    if (c.minTimeOnStep != null) parts.push(`Min time: ${c.minTimeOnStep}s`);
    if (c.maxTimeOnStep != null) parts.push(`Max time: ${c.maxTimeOnStep}s`);
    if (c.minBudget != null) parts.push(`Min budget: $${c.minBudget}/mo`);
    if (c.maxBudget != null) parts.push(`Max budget: $${c.maxBudget}/mo`);
    if (c.hasEmail) parts.push("Has email");
    if (c.hasPhone) parts.push("Has phone");
    return parts.length > 0 ? parts.join(" | ") : "No filters (matches all)";
  };

  interface AudienceStat { tier: string; count: number; totalValue: number }
  interface AudienceStatsResult { stats: AudienceStat[] }
  interface AudienceEvent {
    id: number; sessionId: string; page: string; eventType: string;
    eventTimestamp: string; leadTier: string | null;
    firstName: string | null; lastName: string | null;
    email: string | null; phone: string | null;
    domain: string; deviceType: string | null;
  }
  interface AudienceEventsResult {
    events: AudienceEvent[]; total: number; page: number; totalPages: number;
  }

  const audienceStatsQuery = useQuery<AudienceStatsResult>({
    queryKey: ["/api/meta-conversions/audience-stats", startDate, endDate, audience],
    enabled: activeTab === "audiences",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (audience && audience !== "__all__") params.set("audience", audience);
      const res = await fetch(`/api/meta-conversions/audience-stats?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const audienceEventsQuery = useQuery<AudienceEventsResult>({
    queryKey: ["/api/meta-conversions/audience-events", startDate, endDate, audience, audienceTierFilter, audiencePage],
    enabled: activeTab === "audiences",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (audience && audience !== "__all__") params.set("audience", audience);
      if (audienceTierFilter && audienceTierFilter !== "__all__") params.set("tier", audienceTierFilter);
      params.set("page", audiencePage.toString());
      const res = await fetch(`/api/meta-conversions/audience-events?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const events = eventsQuery.data?.events || [];
  const totalEvents = eventsQuery.data?.total || 0;
  const uploadedCount = eventsQuery.data?.uploaded || 0;
  const syncedCount = eventsQuery.data?.synced || 0;
  const totalPages = Math.max(1, Math.ceil(totalEvents / 50));

  const pendingEvents = useMemo(() => events.filter(e => e.uploadStatus === "pending"), [events]);
  const allPendingIds = useMemo(() => pendingEvents.map(e => e.id), [pendingEvents]);

  const missingEvents = pendingEvents;
  const allMissingIds = allPendingIds;

  const allVisibleSelected = events.length > 0 && events.every(e => e.uploadStatus !== "pending" || selected.has(e.id));

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(missingEvents.map(e => e.id)));
    }
  };

  const handleUploadSelected = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    uploadMutation.mutate({ eventIds: ids });
  };

  const handleUploadAllMissing = () => {
    if (allMissingIds.length === 0) return;
    uploadMutation.mutate({ eventIds: allMissingIds });
  };

  const status = statusQuery.data;
  const isConfigured = status?.configured;

  return (
    <div className="p-3 space-y-3" data-testid="page-meta-conversions">
      <div className="flex items-center gap-2 flex-wrap">
        <SiFacebook className="w-5 h-5 text-[#1877F2]" />
        <h1 className="text-base font-bold" data-testid="text-page-title">Meta Conversions API</h1>
        <Badge variant="outline" className="text-[9px]">CAPI</Badge>
      </div>

      <div className="flex items-center gap-1" data-testid="tab-navigation">
        <Button
          size="sm"
          variant={activeTab === "events" ? "default" : "outline"}
          onClick={() => setActiveTab("events")}
          data-testid="tab-events"
        >
          <Upload className="w-3 h-3 mr-1" />
          <span className="text-[10px]">Events</span>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "audiences" ? "default" : "outline"}
          onClick={() => setActiveTab("audiences")}
          data-testid="tab-audiences"
        >
          <Users className="w-3 h-3 mr-1" />
          <span className="text-[10px]">Custom Audiences</span>
        </Button>
      </div>

      {statusQuery.isLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : status && !isConfigured ? (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
              <span className="text-xs text-destructive font-medium" data-testid="text-status-unconfigured">
                Meta CAPI is not fully configured.
              </span>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {!status.hasPixelId && <Badge variant="destructive" className="text-[9px]">Missing Pixel ID</Badge>}
                {!status.hasAccessToken && <Badge variant="destructive" className="text-[9px]">Missing Access Token</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : status && isConfigured ? (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium" data-testid="text-status-configured">
                Meta CAPI is configured and ready
              </span>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "events" && (
      <div className="space-y-3" data-testid="events-tab-content">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="h-9 rounded-md border px-2 text-[11px] bg-background"
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="h-9 rounded-md border px-2 text-[11px] bg-background"
                data-testid="input-end-date"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Audience</label>
              <Select value={audience} onValueChange={(v) => { setAudience(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]" data-testid="select-audience">
                  <SelectValue placeholder="All audiences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Audiences</SelectItem>
                  <SelectItem value="seniors">Seniors</SelectItem>
                  <SelectItem value="veterans">Veterans</SelectItem>
                  <SelectItem value="first-responders">First Responders</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Ad ID</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={adIdFilter}
                  onChange={(e) => { setAdIdFilter(e.target.value); setPage(1); }}
                  placeholder="Filter by ad ID"
                  className="h-9 rounded-md border px-2 text-[11px] bg-background w-[160px]"
                  data-testid="input-ad-id-filter"
                />
                {adIdFilter && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setAdIdFilter(""); setPage(1); }}
                    data-testid="button-clear-ad-filter"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-[9px]" data-testid="badge-total-events">
            {totalEvents} events
          </Badge>
          <Badge variant="outline" className="text-[9px]" data-testid="badge-uploaded-count">
            {uploadedCount} sent
          </Badge>
          <Badge variant="outline" className="text-[9px]" data-testid="badge-synced-count">
            {syncedCount} synced
          </Badge>
          <Badge variant="outline" className="text-[9px]" data-testid="badge-missing-count">
            {allPendingIds.length} pending
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || syncMutation.isPending}
            onClick={() => syncMutation.mutate({ eventIds: Array.from(selected) })}
            data-testid="button-mark-synced"
          >
            {syncMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            <span className="text-[10px]">Mark {selected.size} as Synced</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={allPendingIds.length === 0 || syncMutation.isPending}
            onClick={() => syncMutation.mutate({ eventIds: allPendingIds })}
            data-testid="button-mark-all-synced"
          >
            {syncMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            <span className="text-[10px]">Mark All as Synced ({allPendingIds.length})</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || uploadMutation.isPending || !isConfigured}
            onClick={handleUploadSelected}
            data-testid="button-upload-selected"
          >
            {uploadMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            <span className="text-[10px]">Upload {selected.size} Selected</span>
          </Button>
          <Button
            size="sm"
            disabled={allMissingIds.length === 0 || uploadMutation.isPending || !isConfigured}
            onClick={handleUploadAllMissing}
            data-testid="button-upload-all-missing"
          >
            {uploadMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            <span className="text-[10px]">Upload All Missing ({allMissingIds.length})</span>
          </Button>
        </div>
      </div>

      <Collapsible open={comparisonOpen} onOpenChange={setComparisonOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="p-3 cursor-pointer">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {comparisonOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <CardTitle className="text-xs font-semibold">Lead Comparison (Ours vs Meta)</CardTitle>
                </div>
                <Badge variant="outline" className="text-[9px]">
                  {comparisonQuery.data?.comparison?.length || 0} ads
                </Badge>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Ad Account</label>
                  {accountsQuery.isLoading ? (
                    <Skeleton className="h-9 w-[240px]" />
                  ) : (
                    <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount}>
                      <SelectTrigger className="w-[280px]" data-testid="select-comparison-ad-account">
                        <SelectValue placeholder="Select ad account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accountsQuery.data?.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id} data-testid={`option-comparison-account-${acc.account_id}`}>
                            <span className="text-[11px]">{acc.name} ({acc.account_id})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
              {comparisonQuery.isLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : !selectedAdAccount ? (
                <p className="text-[10px] text-muted-foreground text-center py-4" data-testid="text-select-account-prompt">
                  Select an ad account to compare lead counts
                </p>
              ) : comparisonQuery.data?.comparison?.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">No comparison data for this period.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Campaign</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Ad Set</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Ad</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Our Leads</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Meta Leads</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparisonQuery.data?.comparison?.map((row) => (
                        <TableRow
                          key={row.adId}
                          data-testid={`row-comparison-${row.adId}`}
                          className={`cursor-pointer hover-elevate ${row.difference > 0 ? "border-l-0" : ""}`}
                          onClick={() => {
                            setAdIdFilter(row.adId);
                            setPage(1);
                            document.getElementById("events-section")?.scrollIntoView({ behavior: "smooth" });
                          }}
                        >
                          <TableCell className="text-[10px] py-1 px-2 max-w-[150px] truncate">{row.campaignName || row.campaignId}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 max-w-[150px] truncate">{row.adsetName || row.adsetId}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 max-w-[150px] truncate">{row.adName || row.adId}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums font-medium">{row.ourLeads}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums font-medium">{row.metaLeads}</TableCell>
                          <TableCell className={`text-[10px] py-1 px-2 text-right tabular-nums font-medium ${row.difference > 0 ? "text-destructive" : row.difference < 0 ? "text-primary" : ""}`}>
                            {row.difference > 0 ? `+${row.difference}` : row.difference}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-[9px] text-muted-foreground mt-2">Click a row to filter events below by that ad</p>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Card id="events-section">
        <CardHeader className="p-3 pb-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-xs font-semibold">Form Complete Events with FB Data</CardTitle>
            {eventsQuery.isFetching && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-2">
          {eventsQuery.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
            </div>
          ) : events.length === 0 ? (
            <p className="text-[10px] text-muted-foreground text-center py-6" data-testid="text-no-events">
              No form_complete events with Facebook data found for this date range.
            </p>
          ) : (
            <>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px] font-semibold py-1 px-1 w-8">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleAll}
                          className="h-3.5 w-3.5"
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Date/Time</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Session</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Audience</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Name</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Email</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Campaign</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Ad Set</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Ad</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Placement</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap text-center">Signals</TableHead>
                      <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((ev) => (
                      <TableRow
                        key={ev.id}
                        className={`${selected.has(ev.id) ? "bg-primary/5" : ""}`}
                        data-testid={`row-event-${ev.id}`}
                      >
                        <TableCell className="py-1 px-1">
                          <Checkbox
                            checked={selected.has(ev.id)}
                            onCheckedChange={() => toggleSelect(ev.id)}
                            disabled={ev.uploaded}
                            className="h-3.5 w-3.5"
                            data-testid={`checkbox-event-${ev.id}`}
                          />
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 whitespace-nowrap tabular-nums" data-testid={`text-event-time-${ev.id}`}>
                          {ev.eventTimestamp ? format(new Date(ev.eventTimestamp), "MMM d, h:mm a") : "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 font-mono" title={ev.sessionId}>
                          {truncateSession(ev.sessionId)}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 capitalize">{ev.page || "-"}</TableCell>
                        <TableCell className="text-[10px] py-1 px-2 truncate max-w-[120px]">
                          {ev.nameInitials || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 truncate max-w-[140px]" title={ev.maskedEmail || ""}>
                          {ev.maskedEmail || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 truncate max-w-[120px]" title={ev.campaignName || ev.campaignId || ""}>
                          {ev.campaignName || ev.campaignId || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 truncate max-w-[120px]" title={ev.adsetName || ev.adsetId || ""}>
                          {ev.adsetName || ev.adsetId || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 truncate max-w-[120px]" title={ev.adName || ev.adId || ""}>
                          {ev.adName || ev.adId || "-"}
                        </TableCell>
                        <TableCell className="text-[10px] py-1 px-2 truncate max-w-[100px]" title={ev.placement || ""}>
                          {ev.placement || "-"}
                        </TableCell>
                        <TableCell className="py-1 px-2">
                          <div className="flex items-center gap-0.5 justify-center">
                            <SignalIcon active={ev.fbclid} icon={MousePointerClick} label="fbclid" />
                            <SignalIcon active={ev.fbp} icon={Fingerprint} label="fbp" />
                            <SignalIcon active={ev.hasEmail} icon={Mail} label="Email" />
                            <SignalIcon active={ev.hasPhone} icon={Phone} label="Phone" />
                            <SignalIcon active={ev.ipAddress} icon={Globe} label="IP Address" />
                          </div>
                        </TableCell>
                        <TableCell className="py-1 px-2 text-center">
                          {ev.uploadStatus === "sent" ? (
                            <Badge variant="secondary" className="text-[8px]" data-testid={`badge-sent-${ev.id}`}>
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                              Sent
                            </Badge>
                          ) : ev.uploadStatus === "synced" ? (
                            <Badge variant="secondary" className="text-[8px]" data-testid={`badge-synced-${ev.id}`}>
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                              Synced
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px]" data-testid={`badge-pending-${ev.id}`}>
                              Pending
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground" data-testid="text-pagination-info">
                  Page {page} of {totalPages} ({totalEvents} events)
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                    data-testid="button-first-page"
                  >
                    <ChevronsLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={page >= totalPages}
                    onClick={() => setPage(totalPages)}
                    data-testid="button-last-page"
                  >
                    <ChevronsRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="p-3 cursor-pointer">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {historyOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <CardTitle className="text-xs font-semibold">Upload History</CardTitle>
                </div>
                <History className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-3 pt-0">
              {historyQuery.isLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ) : !historyQuery.data?.history?.length ? (
                <p className="text-[10px] text-muted-foreground text-center py-4" data-testid="text-no-history">
                  No upload history yet.
                </p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap">Sent At</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Events</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Sent</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Received</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-center whitespace-nowrap">Mode</TableHead>
                        <TableHead className="text-[10px] font-semibold py-1 px-2 text-center whitespace-nowrap">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyQuery.data.history.map((entry) => (
                        <TableRow key={entry.id} data-testid={`row-history-${entry.id}`}>
                          <TableCell className="text-[10px] py-1 px-2 whitespace-nowrap tabular-nums">
                            {entry.sentAt ? format(new Date(entry.sentAt), "MMM d, h:mm a") : "-"}
                          </TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{entry.eventCount}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{entry.sent}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{entry.received}</TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-center">
                            {entry.testMode ? (
                              <Badge variant="outline" className="text-[8px]">Test</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[8px]">Live</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-[10px] py-1 px-2 text-center">
                            {entry.status === "success" ? (
                              <CheckCircle2 className="w-3 h-3 text-primary inline-block" />
                            ) : entry.status === "error" ? (
                              <XCircle className="w-3 h-3 text-destructive inline-block" />
                            ) : (
                              <Clock className="w-3 h-3 text-muted-foreground inline-block" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
      </div>
      )}

      {activeTab === "audiences" && (
        <div className="space-y-3" data-testid="audiences-tab-content">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setAudiencePage(1); }}
                    className="h-9 rounded-md border px-2 text-[11px] bg-background"
                    data-testid="input-audience-start-date"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setAudiencePage(1); }}
                    className="h-9 rounded-md border px-2 text-[11px] bg-background"
                    data-testid="input-audience-end-date"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Audience</label>
                  <Select value={audience} onValueChange={(v) => { setAudience(v); setAudiencePage(1); }}>
                    <SelectTrigger className="h-9 w-[130px] text-[11px]" data-testid="select-audience-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Audiences</SelectItem>
                      <SelectItem value="seniors">Seniors</SelectItem>
                      <SelectItem value="veterans">Veterans</SelectItem>
                      <SelectItem value="first-responders">First Responders</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">Tier</label>
                  <Select value={audienceTierFilter} onValueChange={(v) => { setAudienceTierFilter(v); setAudiencePage(1); }}>
                    <SelectTrigger className="h-9 w-[160px] text-[11px]" data-testid="select-tier-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Tiers</SelectItem>
                      <SelectItem value="QualifiedLead">Qualified Lead</SelectItem>
                      <SelectItem value="DisqualifiedLead">Disqualified Lead</SelectItem>
                      <SelectItem value="HighValueCustomer">High Value Customer</SelectItem>
                      <SelectItem value="LowValueCustomer">Low Value Customer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Audience Signal Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {audienceStatsQuery.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : audienceStatsQuery.data?.stats && audienceStatsQuery.data.stats.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {(() => {
                    const stats = audienceStatsQuery.data.stats;
                    const tierConfig: Record<string, { icon: typeof UserCheck; label: string; color: string }> = {
                      QualifiedLead: { icon: UserCheck, label: "Qualified Leads", color: "text-green-600 dark:text-green-400" },
                      DisqualifiedLead: { icon: UserX, label: "Disqualified Leads", color: "text-red-500 dark:text-red-400" },
                      HighValueCustomer: { icon: DollarSign, label: "High Value", color: "text-blue-600 dark:text-blue-400" },
                      LowValueCustomer: { icon: DollarSign, label: "Low Value", color: "text-amber-600 dark:text-amber-400" },
                    };
                    const allTiers = ["QualifiedLead", "DisqualifiedLead", "HighValueCustomer", "LowValueCustomer"];
                    return allTiers.map((tier) => {
                      const stat = stats.find(s => s.tier === tier);
                      const cfg = tierConfig[tier];
                      const Icon = cfg.icon;
                      return (
                        <Card key={tier} data-testid={`stat-card-${tier}`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Icon className={`w-3 h-3 ${cfg.color}`} />
                              <span className="text-[10px] text-muted-foreground">{cfg.label}</span>
                            </div>
                            <div className="text-lg font-bold" data-testid={`stat-count-${tier}`}>
                              {stat?.count || 0}
                            </div>
                            {(tier === "HighValueCustomer" || tier === "LowValueCustomer") && stat && stat.totalValue > 0 && (
                              <div className="text-[10px] text-muted-foreground" data-testid={`stat-value-${tier}`}>
                                ${stat.totalValue.toLocaleString()} total value
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No audience signals in this date range.</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-signal-rules">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Shield className="w-3 h-3" />
                  Signal Rules
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { resetRuleForm(); setEditingRuleId(null); setNewRuleOpen(true); }}
                  data-testid="button-new-rule"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">New Rule</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {newRuleOpen && (
                <div className="border rounded-md p-3 space-y-3 bg-muted/30" data-testid="form-new-rule">
                  <div className="text-[11px] font-semibold">New Signal Rule</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Rule Name</label>
                      <input
                        type="text"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                        data-testid="input-rule-name"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Trigger Event</label>
                      <Select value={ruleTriggerEvent} onValueChange={setRuleTriggerEvent}>
                        <SelectTrigger className="w-full" data-testid="select-rule-trigger">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="page_land">page_land</SelectItem>
                          <SelectItem value="step_complete">step_complete</SelectItem>
                          <SelectItem value="form_complete">form_complete</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Meta Event Name</label>
                      <input
                        type="text"
                        value={ruleMetaEventName}
                        onChange={(e) => setRuleMetaEventName(e.target.value)}
                        placeholder="e.g. QualifiedLead"
                        className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                        data-testid="input-rule-meta-event"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Custom Value</label>
                      <input
                        type="number"
                        value={ruleCustomValue}
                        onChange={(e) => setRuleCustomValue(e.target.value)}
                        placeholder="Auto-calculate"
                        className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                        data-testid="input-rule-custom-value"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Currency</label>
                      <input
                        type="text"
                        value={ruleCurrency}
                        onChange={(e) => setRuleCurrency(e.target.value)}
                        className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                        data-testid="input-rule-currency"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-muted-foreground uppercase">Content Name</label>
                      <input
                        type="text"
                        value={ruleContentName}
                        onChange={(e) => setRuleContentName(e.target.value)}
                        placeholder="Optional"
                        className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                        data-testid="input-rule-content-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase">Conditions</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Audience</label>
                        <div className="space-y-1">
                          {["seniors", "veterans", "first-responders"].map((v) => (
                            <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ruleCondAudience.includes(v)}
                                onChange={() => toggleConditionArray(ruleCondAudience, v, setRuleCondAudience)}
                                className="h-3 w-3 rounded-sm"
                                data-testid={`checkbox-cond-audience-${v}`}
                              />
                              <span className="capitalize">{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Domain</label>
                        <div className="space-y-1">
                          {["blueskylife.net", "blueskylife.io"].map((v) => (
                            <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ruleCondDomain.includes(v)}
                                onChange={() => toggleConditionArray(ruleCondDomain, v, setRuleCondDomain)}
                                className="h-3 w-3 rounded-sm"
                                data-testid={`checkbox-cond-domain-${v}`}
                              />
                              <span>{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Device Type</label>
                        <div className="space-y-1">
                          {["mobile", "desktop", "tablet"].map((v) => (
                            <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ruleCondDeviceType.includes(v)}
                                onChange={() => toggleConditionArray(ruleCondDeviceType, v, setRuleCondDeviceType)}
                                className="h-3 w-3 rounded-sm"
                                data-testid={`checkbox-cond-device-${v}`}
                              />
                              <span className="capitalize">{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Page Type</label>
                        <div className="space-y-1">
                          {["lead", "call"].map((v) => (
                            <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={ruleCondPageType.includes(v)}
                                onChange={() => toggleConditionArray(ruleCondPageType, v, setRuleCondPageType)}
                                className="h-3 w-3 rounded-sm"
                                data-testid={`checkbox-cond-page-${v}`}
                              />
                              <span className="capitalize">{v}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Step Name</label>
                        <input
                          type="text"
                          value={ruleCondStepName}
                          onChange={(e) => setRuleCondStepName(e.target.value)}
                          placeholder="e.g. Eligibility Check"
                          className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                          data-testid="input-cond-step-name"
                        />
                        <span className="text-[9px] text-muted-foreground">Comma-separated</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Step Number</label>
                        <input
                          type="text"
                          value={ruleCondStepNumber}
                          onChange={(e) => setRuleCondStepNumber(e.target.value)}
                          placeholder="e.g. 6, 7"
                          className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                          data-testid="input-cond-step-number"
                        />
                        <span className="text-[9px] text-muted-foreground">Comma-separated</span>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Min Time on Step (s)</label>
                        <input
                          type="number"
                          value={ruleCondMinTime}
                          onChange={(e) => setRuleCondMinTime(e.target.value)}
                          className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                          data-testid="input-cond-min-time"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Max Time on Step (s)</label>
                        <input
                          type="number"
                          value={ruleCondMaxTime}
                          onChange={(e) => setRuleCondMaxTime(e.target.value)}
                          className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                          data-testid="input-cond-max-time"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Min Budget ($/mo)</label>
                        <input
                          type="number"
                          value={ruleCondMinBudget}
                          onChange={(e) => setRuleCondMinBudget(e.target.value)}
                          placeholder="e.g. 100"
                          className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                          data-testid="input-cond-min-budget"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-medium text-muted-foreground">Max Budget ($/mo)</label>
                        <input
                          type="number"
                          value={ruleCondMaxBudget}
                          onChange={(e) => setRuleCondMaxBudget(e.target.value)}
                          placeholder="e.g. 500"
                          className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                          data-testid="input-cond-max-budget"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ruleCondHasEmail}
                            onChange={(e) => setRuleCondHasEmail(e.target.checked)}
                            className="h-3 w-3 rounded-sm"
                            data-testid="checkbox-cond-has-email"
                          />
                          <span>Has Email</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ruleCondHasPhone}
                            onChange={(e) => setRuleCondHasPhone(e.target.checked)}
                            className="h-3 w-3 rounded-sm"
                            data-testid="checkbox-cond-has-phone"
                          />
                          <span>Has Phone</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={!ruleName || !ruleMetaEventName || createRuleMutation.isPending}
                      onClick={() => createRuleMutation.mutate(buildRulePayload())}
                      data-testid="button-save-new-rule"
                    >
                      {createRuleMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      <span className="text-[10px]">Save Rule</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setNewRuleOpen(false); resetRuleForm(); }}
                      data-testid="button-cancel-new-rule"
                    >
                      <span className="text-[10px]">Cancel</span>
                    </Button>
                  </div>
                </div>
              )}

              {signalRulesQuery.isLoading ? (
                <div className="space-y-1">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : signalRulesQuery.data?.rules && signalRulesQuery.data.rules.length > 0 ? (
                <div className="space-y-1">
                  {signalRulesQuery.data.rules.map((rule) => (
                    <div key={rule.id} data-testid={`rule-row-${rule.id}`}>
                      <Collapsible open={editingRuleId === rule.id} onOpenChange={(open) => {
                        if (isRuleLocked(rule.id)) return;
                        if (open) {
                          setEditingRuleId(rule.id);
                          setNewRuleOpen(false);
                          populateRuleForm(rule);
                        } else {
                          setEditingRuleId(null);
                          resetRuleForm();
                        }
                      }}>
                        <div className="flex items-center justify-between gap-2 p-2 rounded-md border flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CollapsibleTrigger asChild>
                              <Button size="icon" variant="ghost" disabled={isRuleLocked(rule.id)} data-testid={`button-expand-rule-${rule.id}`}>
                                {editingRuleId === rule.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </Button>
                            </CollapsibleTrigger>
                            <span className="text-[11px] font-medium" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</span>
                            <Badge variant="outline" className="text-[9px]" data-testid={`badge-rule-trigger-${rule.id}`}>{rule.triggerEvent}</Badge>
                            <Badge variant="secondary" className="text-[9px]" data-testid={`badge-rule-meta-event-${rule.id}`}>{rule.metaEventName}</Badge>
                            <span className="text-[9px] text-muted-foreground" data-testid={`text-rule-conditions-${rule.id}`}>{summarizeConditions(rule.conditions)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleRuleLock(rule.id)}
                              data-testid={`button-lock-rule-${rule.id}`}
                            >
                              {isRuleLocked(rule.id) ? <Lock className="w-3 h-3 text-amber-500" /> : <Unlock className="w-3 h-3 text-muted-foreground" />}
                            </Button>
                            <div
                              className={`flex items-center gap-1.5 ${isRuleLocked(rule.id) ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}
                              onClick={() => { if (!isRuleLocked(rule.id)) toggleRuleActive(rule); }}
                              data-testid={`toggle-rule-active-${rule.id}`}
                            >
                              <Switch
                                checked={rule.active === 1}
                                disabled={isRuleLocked(rule.id)}
                                onCheckedChange={() => { if (!isRuleLocked(rule.id)) toggleRuleActive(rule); }}
                                className="scale-75"
                              />
                              <span className={`text-[9px] font-medium ${rule.active === 1 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                                {rule.active === 1 ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <CollapsibleTrigger asChild>
                              <Button size="icon" variant="ghost" disabled={isRuleLocked(rule.id)} data-testid={`button-edit-rule-${rule.id}`}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </CollapsibleTrigger>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => { if (!isRuleLocked(rule.id)) deleteRuleMutation.mutate(rule.id); }}
                              disabled={isRuleLocked(rule.id) || deleteRuleMutation.isPending}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <CollapsibleContent>
                          <div className="border border-t-0 rounded-b-md p-3 space-y-3 bg-muted/30" data-testid={`form-edit-rule-${rule.id}`}>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Rule Name</label>
                                <input
                                  type="text"
                                  value={ruleName}
                                  onChange={(e) => setRuleName(e.target.value)}
                                  className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                  data-testid="input-edit-rule-name"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Trigger Event</label>
                                <Select value={ruleTriggerEvent} onValueChange={setRuleTriggerEvent}>
                                  <SelectTrigger className="w-full" data-testid="select-edit-rule-trigger">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="page_land">page_land</SelectItem>
                                    <SelectItem value="step_complete">step_complete</SelectItem>
                                    <SelectItem value="form_complete">form_complete</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Meta Event Name</label>
                                <input
                                  type="text"
                                  value={ruleMetaEventName}
                                  onChange={(e) => setRuleMetaEventName(e.target.value)}
                                  placeholder="e.g. QualifiedLead"
                                  className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                  data-testid="input-edit-rule-meta-event"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Custom Value</label>
                                <input
                                  type="number"
                                  value={ruleCustomValue}
                                  onChange={(e) => setRuleCustomValue(e.target.value)}
                                  placeholder="Auto-calculate"
                                  className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                  data-testid="input-edit-rule-custom-value"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Currency</label>
                                <input
                                  type="text"
                                  value={ruleCurrency}
                                  onChange={(e) => setRuleCurrency(e.target.value)}
                                  className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                  data-testid="input-edit-rule-currency"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground uppercase">Content Name</label>
                                <input
                                  type="text"
                                  value={ruleContentName}
                                  onChange={(e) => setRuleContentName(e.target.value)}
                                  placeholder="Optional"
                                  className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                  data-testid="input-edit-rule-content-name"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase">Conditions</div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Audience</label>
                                  <div className="space-y-1">
                                    {["seniors", "veterans", "first-responders"].map((v) => (
                                      <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ruleCondAudience.includes(v)}
                                          onChange={() => toggleConditionArray(ruleCondAudience, v, setRuleCondAudience)}
                                          className="h-3 w-3 rounded-sm"
                                          data-testid={`checkbox-edit-cond-audience-${v}`}
                                        />
                                        <span className="capitalize">{v}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Domain</label>
                                  <div className="space-y-1">
                                    {["blueskylife.net", "blueskylife.io"].map((v) => (
                                      <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ruleCondDomain.includes(v)}
                                          onChange={() => toggleConditionArray(ruleCondDomain, v, setRuleCondDomain)}
                                          className="h-3 w-3 rounded-sm"
                                          data-testid={`checkbox-edit-cond-domain-${v}`}
                                        />
                                        <span>{v}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Device Type</label>
                                  <div className="space-y-1">
                                    {["mobile", "desktop", "tablet"].map((v) => (
                                      <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ruleCondDeviceType.includes(v)}
                                          onChange={() => toggleConditionArray(ruleCondDeviceType, v, setRuleCondDeviceType)}
                                          className="h-3 w-3 rounded-sm"
                                          data-testid={`checkbox-edit-cond-device-${v}`}
                                        />
                                        <span className="capitalize">{v}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Page Type</label>
                                  <div className="space-y-1">
                                    {["lead", "call"].map((v) => (
                                      <label key={v} className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={ruleCondPageType.includes(v)}
                                          onChange={() => toggleConditionArray(ruleCondPageType, v, setRuleCondPageType)}
                                          className="h-3 w-3 rounded-sm"
                                          data-testid={`checkbox-edit-cond-page-${v}`}
                                        />
                                        <span className="capitalize">{v}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Step Name</label>
                                  <input
                                    type="text"
                                    value={ruleCondStepName}
                                    onChange={(e) => setRuleCondStepName(e.target.value)}
                                    placeholder="e.g. Eligibility Check"
                                    className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                    data-testid="input-edit-cond-step-name"
                                  />
                                  <span className="text-[9px] text-muted-foreground">Comma-separated</span>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Step Number</label>
                                  <input
                                    type="text"
                                    value={ruleCondStepNumber}
                                    onChange={(e) => setRuleCondStepNumber(e.target.value)}
                                    placeholder="e.g. 6, 7"
                                    className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                    data-testid="input-edit-cond-step-number"
                                  />
                                  <span className="text-[9px] text-muted-foreground">Comma-separated</span>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Min Time on Step (s)</label>
                                  <input
                                    type="number"
                                    value={ruleCondMinTime}
                                    onChange={(e) => setRuleCondMinTime(e.target.value)}
                                    className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                    data-testid="input-edit-cond-min-time"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Max Time on Step (s)</label>
                                  <input
                                    type="number"
                                    value={ruleCondMaxTime}
                                    onChange={(e) => setRuleCondMaxTime(e.target.value)}
                                    className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                    data-testid="input-edit-cond-max-time"
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Min Budget ($/mo)</label>
                                  <input
                                    type="number"
                                    value={ruleCondMinBudget}
                                    onChange={(e) => setRuleCondMinBudget(e.target.value)}
                                    placeholder="e.g. 100"
                                    className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                    data-testid="input-edit-cond-min-budget"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-medium text-muted-foreground">Max Budget ($/mo)</label>
                                  <input
                                    type="number"
                                    value={ruleCondMaxBudget}
                                    onChange={(e) => setRuleCondMaxBudget(e.target.value)}
                                    placeholder="e.g. 500"
                                    className="h-9 w-full rounded-md border px-2 text-[11px] bg-background"
                                    data-testid="input-edit-cond-max-budget"
                                  />
                                </div>
                                <div className="flex items-end gap-3">
                                  <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={ruleCondHasEmail}
                                      onChange={(e) => setRuleCondHasEmail(e.target.checked)}
                                      className="h-3 w-3 rounded-sm"
                                      data-testid="checkbox-edit-cond-has-email"
                                    />
                                    <span>Has Email</span>
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[10px] cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={ruleCondHasPhone}
                                      onChange={(e) => setRuleCondHasPhone(e.target.checked)}
                                      className="h-3 w-3 rounded-sm"
                                      data-testid="checkbox-edit-cond-has-phone"
                                    />
                                    <span>Has Phone</span>
                                  </label>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                disabled={!ruleName || !ruleMetaEventName || updateRuleMutation.isPending}
                                onClick={() => updateRuleMutation.mutate({ id: rule.id, ...buildRulePayload() })}
                                data-testid="button-save-edit-rule"
                              >
                                {updateRuleMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                                <span className="text-[10px]">Save Changes</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingRuleId(null); resetRuleForm(); }}
                                data-testid="button-cancel-edit-rule"
                              >
                                <span className="text-[10px]">Cancel</span>
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  ))}
                </div>
              ) : !signalRulesQuery.isLoading && !newRuleOpen ? (
                <p className="text-[10px] text-muted-foreground text-center py-4" data-testid="text-no-rules">
                  No signal rules configured. Click "+ New Rule" to create one.
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Info className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Audience signals are fired automatically to Meta CAPI when events are received.
                  Use these Custom Audiences in Facebook Ads Manager to create Lookalike Audiences for targeting.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Users className="w-3 h-3" />
                  Audience Events
                  {audienceEventsQuery.data && (
                    <Badge variant="secondary" className="text-[9px]">
                      {audienceEventsQuery.data.total} events
                    </Badge>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {audienceEventsQuery.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : audienceEventsQuery.data?.events && audienceEventsQuery.data.events.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px] w-[100px]">Timestamp</TableHead>
                          <TableHead className="text-[10px] w-[80px]">Audience</TableHead>
                          <TableHead className="text-[10px] w-[90px]">Event</TableHead>
                          <TableHead className="text-[10px] w-[120px]">Tier</TableHead>
                          <TableHead className="text-[10px] w-[100px]">Name</TableHead>
                          <TableHead className="text-[10px] w-[80px]">Domain</TableHead>
                          <TableHead className="text-[10px] w-[60px]">Device</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audienceEventsQuery.data.events.map((ev) => {
                          const tierBadge: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
                            QualifiedLead: { variant: "default", label: "Qualified" },
                            DisqualifiedLead: { variant: "destructive", label: "Disqualified" },
                            HighValueCustomer: { variant: "default", label: "High Value" },
                            LowValueCustomer: { variant: "secondary", label: "Low Value" },
                          };
                          const tb = ev.leadTier ? tierBadge[ev.leadTier] : null;
                          return (
                            <TableRow key={ev.id} data-testid={`audience-event-row-${ev.id}`}>
                              <TableCell className="text-[10px]">
                                {format(new Date(ev.eventTimestamp), "MMM d, HH:mm")}
                              </TableCell>
                              <TableCell className="text-[10px] capitalize">{ev.page}</TableCell>
                              <TableCell className="text-[10px]">
                                <Badge variant="outline" className="text-[9px]">{ev.eventType}</Badge>
                              </TableCell>
                              <TableCell>
                                {tb ? (
                                  <Badge variant={tb.variant} className="text-[9px]">
                                    {tb.label}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-[10px]">
                                {ev.firstName || ev.lastName
                                  ? `${ev.firstName || ""} ${ev.lastName || ""}`.trim()
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-[10px]">{ev.domain}</TableCell>
                              <TableCell className="text-[10px] capitalize">{ev.deviceType || "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {audienceEventsQuery.data.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        Page {audienceEventsQuery.data.page} of {audienceEventsQuery.data.totalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={audiencePage <= 1}
                          onClick={() => setAudiencePage(1)}
                          data-testid="btn-audience-first-page"
                        >
                          <ChevronsLeft className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={audiencePage <= 1}
                          onClick={() => setAudiencePage(p => Math.max(1, p - 1))}
                          data-testid="btn-audience-prev-page"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={audiencePage >= audienceEventsQuery.data.totalPages}
                          onClick={() => setAudiencePage(p => p + 1)}
                          data-testid="btn-audience-next-page"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={audiencePage >= audienceEventsQuery.data.totalPages}
                          onClick={() => setAudiencePage(audienceEventsQuery.data!.totalPages)}
                          data-testid="btn-audience-last-page"
                        >
                          <ChevronsRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">No audience events found for the selected filters.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
