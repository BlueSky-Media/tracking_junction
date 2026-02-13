import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Upload, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  Mail, Phone, Globe, Fingerprint, MousePointerClick, Clock, History,
  ArrowUpDown, Loader2, Info, Shield, ChevronLeft, ChevronsLeft, ChevronsRight,
} from "lucide-react";
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

  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [audience, setAudience] = useState("__all__");
  const [adIdFilter, setAdIdFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [testMode, setTestMode] = useState(false);
  const [testEventCode, setTestEventCode] = useState(() => localStorage.getItem("capi_test_event_code") || "");
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");

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
    mutationFn: async (payload: { eventIds: number[]; testMode?: boolean; testEventCode?: string }) => {
      const res = await apiRequest("POST", "/api/meta-conversions/upload", payload);
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: (data) => {
      toast({
        title: `Upload complete: ${data.received}/${data.sent} events processed`,
        description: data.testMode
          ? `Test mode - code: ${data.testEventCode} | Pixel: ${data.pixelId}`
          : `Sent to pixel: ${data.pixelId}`,
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

  const events = eventsQuery.data?.events || [];
  const totalEvents = eventsQuery.data?.total || 0;
  const uploadedCount = eventsQuery.data?.uploaded || 0;
  const totalPages = Math.max(1, Math.ceil(totalEvents / 50));

  const missingEvents = useMemo(() => events.filter(e => !e.uploaded), [events]);
  const allMissingIds = useMemo(() => missingEvents.map(e => e.id), [missingEvents]);

  const allVisibleSelected = events.length > 0 && events.every(e => e.uploaded || selected.has(e.id));

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
    uploadMutation.mutate({ eventIds: ids, testMode, testEventCode: testMode && testEventCode ? testEventCode : undefined });
  };

  const handleUploadAllMissing = () => {
    if (allMissingIds.length === 0) return;
    uploadMutation.mutate({ eventIds: allMissingIds, testMode, testEventCode: testMode && testEventCode ? testEventCode : undefined });
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
            {uploadedCount} uploaded
          </Badge>
          <Badge variant="outline" className="text-[9px]" data-testid="badge-missing-count">
            {totalEvents - uploadedCount} missing
          </Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Switch
              checked={testMode}
              onCheckedChange={setTestMode}
              data-testid="switch-test-mode"
            />
            <span className="text-[10px] text-muted-foreground" title="Events are still posted live but also appear in Facebook's Test Events tab for verification">Test Mode (visible in FB Test tab)</span>
          </div>
          {testMode && (
            <input
              type="text"
              value={testEventCode}
              onChange={(e) => {
                setTestEventCode(e.target.value);
                localStorage.setItem("capi_test_event_code", e.target.value);
              }}
              placeholder="Paste test_event_code from Events Manager (required)"
              className={`h-8 rounded-md border px-2 text-[10px] bg-background w-[280px] ${!testEventCode.trim() ? "border-destructive" : ""}`}
              data-testid="input-test-event-code"
            />
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0 || uploadMutation.isPending || !isConfigured || (testMode && !testEventCode.trim())}
            onClick={handleUploadSelected}
            data-testid="button-upload-selected"
          >
            {uploadMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
            <span className="text-[10px]">Upload {selected.size} Selected</span>
          </Button>
          <Button
            size="sm"
            disabled={allMissingIds.length === 0 || uploadMutation.isPending || !isConfigured || (testMode && !testEventCode.trim())}
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
                          {ev.uploaded ? (
                            <Badge variant="secondary" className="text-[8px]" data-testid={`badge-uploaded-${ev.id}`}>
                              <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                              Sent
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
  );
}
