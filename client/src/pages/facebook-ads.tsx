import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight, ChevronDown, TrendingUp, DollarSign, Eye, MousePointerClick, Users, CalendarIcon, Columns3, Target, Link2 } from "lucide-react";
import { SiFacebook } from "react-icons/si";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";

interface NormalizedInsight {
  campaignId?: string;
  campaignName?: string;
  adsetId?: string;
  adsetName?: string;
  adId?: string;
  adName?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  leads: number;
  costPerLead: number;
  purchases: number;
  costPerPurchase: number;
  linkClicks: number;
  results: number;
  resultRate: number;
  costPerResult: number;
  outboundClicks: number;
  costPerOutboundClick: number;
  outboundCtr: number;
  thruPlays: number;
  costPerThruPlay: number;
  videoPlays: number;
  videoAvgPlayTime: number;
  videoP25: number;
  videoP50: number;
  videoP75: number;
  videoP95: number;
  videoP100: number;
  video2SecPlays: number;
  costPer2SecPlay: number;
  video3SecPlays: number;
  costPer3SecPlay: number;
  video3SecRate: number;
  searches: number;
  costPerCall: number;
  callRate: number;
  contacts: number;
  costPerContact: number;
  contactRate: number;
  landingPageConversionRate: number;
  costPer1000Reached: number;
  qualityRanking: string;
  engagementRateRanking: string;
  conversionRateRanking: string;
  dateStart: string;
  dateStop: string;
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

function fmt$(v: number) { return "$" + v.toFixed(2); }
function fmtN(v: number) { return v.toLocaleString(); }
function fmtPct(v: number) { return v.toFixed(2) + "%"; }
function fmtTime(seconds: number) {
  if (seconds < 60) return seconds.toFixed(1) + "s";
  return Math.floor(seconds / 60) + "m " + Math.round(seconds % 60) + "s";
}

function toTzDateStr(d: Date, tz?: string): string {
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    } catch {}
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultDates(tz?: string) {
  const now = new Date();
  return {
    startDate: toTzDateStr(new Date(now.getTime() - 7 * 86400000), tz),
    endDate: toTzDateStr(now, tz),
  };
}

const FB_DATE_PRESETS: { label: string; getRange: () => { start: Date; end: Date } }[] = [
  { label: "Today", getRange: () => { const d = new Date(); return { start: d, end: d }; } },
  { label: "Yesterday", getRange: () => { const d = subDays(new Date(), 1); return { start: d, end: d }; } },
  { label: "Last 7 Days", getRange: () => ({ start: subDays(new Date(), 6), end: new Date() }) },
  { label: "Last 14 Days", getRange: () => ({ start: subDays(new Date(), 13), end: new Date() }) },
  { label: "Last 30 Days", getRange: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
  { label: "Last 90 Days", getRange: () => ({ start: subDays(new Date(), 89), end: new Date() }) },
  { label: "This Week", getRange: () => ({ start: startOfWeek(new Date(), { weekStartsOn: 1 }), end: new Date() }) },
  { label: "This Month", getRange: () => ({ start: startOfMonth(new Date()), end: new Date() }) },
  { label: "Last Month", getRange: () => {
    const prev = subMonths(new Date(), 1);
    return { start: startOfMonth(prev), end: endOfMonth(prev) };
  }},
];

type DrillLevel = "campaigns" | "adsets" | "ads";

interface ColumnDef {
  key: string;
  label: string;
  isCustom?: boolean;
  render: (row: NormalizedInsight) => string | JSX.Element;
  align?: "left" | "right";
}

function RankingBadge({ value }: { value: string }) {
  if (!value || value === "" || value === "UNKNOWN") return <span className="text-muted-foreground">-</span>;
  const lower = value.toLowerCase().replace(/_/g, " ");
  if (value.includes("ABOVE_AVERAGE")) {
    return <Badge variant="outline" className="text-[9px] border-green-500/50 text-green-600 dark:text-green-400 no-default-hover-elevate no-default-active-elevate">{lower}</Badge>;
  }
  if (value === "AVERAGE") {
    return <Badge variant="outline" className="text-[9px] border-yellow-500/50 text-yellow-600 dark:text-yellow-400 no-default-hover-elevate no-default-active-elevate">{lower}</Badge>;
  }
  if (value.includes("BELOW_AVERAGE")) {
    return <Badge variant="outline" className="text-[9px] border-red-500/50 text-red-600 dark:text-red-400 no-default-hover-elevate no-default-active-elevate">{lower}</Badge>;
  }
  return <Badge variant="outline" className="text-[9px] no-default-hover-elevate no-default-active-elevate">{lower}</Badge>;
}

function buildColumns(drillLevel: DrillLevel): ColumnDef[] {
  const nameLabel = drillLevel === "campaigns" ? "Campaign" : drillLevel === "adsets" ? "Ad Set" : "Ad";

  const getName = (row: NormalizedInsight) => {
    if (drillLevel === "campaigns") return row.campaignName || row.campaignId || "-";
    if (drillLevel === "adsets") return row.adsetName || row.adsetId || "-";
    return row.adName || row.adId || "-";
  };

  return [
    { key: "name", label: nameLabel, align: "left", render: (row) => getName(row) },
    { key: "delivery", label: "Delivery", align: "left", render: () => <Badge variant="outline" className="text-[9px] no-default-hover-elevate no-default-active-elevate">Active</Badge> },
    { key: "campaignId", label: "Campaign ID", align: "left", render: (row) => row.campaignId || "-" },
    { key: "adsetId", label: "Ad Set ID", align: "left", render: (row) => row.adsetId || "-" },
    { key: "adId", label: "Ad ID", align: "left", render: (row) => row.adId || "-" },
    { key: "budget", label: "Budget", align: "right", render: (row) => fmt$(row.spend) },
    { key: "amountSpent", label: "Amount Spent", align: "right", render: (row) => fmt$(row.spend) },
    { key: "frequency", label: "Frequency", align: "right", render: (row) => row.frequency.toFixed(2) },
    { key: "impressions", label: "Impressions", align: "right", render: (row) => fmtN(row.impressions) },
    { key: "cpm", label: "CPM", align: "right", render: (row) => fmt$(row.cpm) },
    { key: "reach", label: "Reach", align: "right", render: (row) => fmtN(row.reach) },
    { key: "costPer1000Reached", label: "Cost per 1,000 Reached", align: "right", render: (row) => fmt$(row.costPer1000Reached) },
    { key: "cpc", label: "CPC (All)", align: "right", render: (row) => fmt$(row.cpc) },
    { key: "clicks", label: "Clicks (All)", align: "right", render: (row) => fmtN(row.clicks) },
    { key: "ctr", label: "CTR (All)", align: "right", render: (row) => fmtPct(row.ctr) },
    { key: "cpcLinkClick", label: "CPC (Link Click)", align: "right", render: (row) => row.linkClicks > 0 ? fmt$(row.spend / row.linkClicks) : "-" },
    { key: "linkClicks", label: "Link Clicks", align: "right", render: (row) => row.linkClicks > 0 ? fmtN(row.linkClicks) : "-" },
    { key: "costPerOutboundClick", label: "Cost per Outbound Click", align: "right", render: (row) => row.costPerOutboundClick > 0 ? fmt$(row.costPerOutboundClick) : "-" },
    { key: "outboundClicks", label: "Outbound Clicks", align: "right", render: (row) => row.outboundClicks > 0 ? fmtN(row.outboundClicks) : "-" },
    { key: "outboundCtr", label: "Outbound CTR", align: "right", render: (row) => row.outboundCtr > 0 ? fmtPct(row.outboundCtr) : "-" },
    { key: "results", label: "Results", align: "right", render: (row) => row.results > 0 ? fmtN(row.results) : "-" },
    { key: "resultRate", label: "Result Rate", align: "right", render: (row) => row.resultRate > 0 ? fmtPct(row.resultRate) : "-" },
    { key: "costPerResult", label: "Cost per Result", align: "right", render: (row) => row.costPerResult > 0 ? fmt$(row.costPerResult) : "-" },
    { key: "leads", label: "Leads", align: "right", render: (row) => row.leads > 0 ? fmtN(row.leads) : "-" },
    { key: "costPerLead", label: "Cost Per Lead", align: "right", isCustom: true, render: (row) => row.leads > 0 ? fmt$(row.spend / row.leads) : "-" },
    { key: "landingPageConversionRate", label: "Landing Page Conv. Rate", align: "right", isCustom: true, render: (row) => row.linkClicks > 0 ? fmtPct((row.leads / row.linkClicks) * 100) : "-" },
    { key: "searches", label: "Searches", align: "right", render: (row) => row.searches > 0 ? fmtN(row.searches) : "-" },
    { key: "costPerCall", label: "Cost Per Call", align: "right", isCustom: true, render: (row) => row.searches > 0 ? fmt$(row.spend / row.searches) : "-" },
    { key: "callRate", label: "Call Rate", align: "right", isCustom: true, render: (row) => row.leads > 0 ? fmtPct((row.searches / row.leads) * 100) : "-" },
    { key: "contacts", label: "Contacts", align: "right", render: (row) => row.contacts > 0 ? fmtN(row.contacts) : "-" },
    { key: "costPerContact", label: "Cost Per Contact", align: "right", isCustom: true, render: (row) => row.contacts > 0 ? fmt$(row.spend / row.contacts) : "-" },
    { key: "contactRate", label: "Contact Rate", align: "right", isCustom: true, render: (row) => row.leads > 0 ? fmtPct((row.contacts / row.leads) * 100) : "-" },
    { key: "videoPlays", label: "Video Plays", align: "right", render: (row) => row.videoPlays > 0 ? fmtN(row.videoPlays) : "-" },
    { key: "costPerThruPlay", label: "Cost per ThruPlay", align: "right", render: (row) => row.costPerThruPlay > 0 ? fmt$(row.costPerThruPlay) : "-" },
    { key: "thruPlays", label: "ThruPlays", align: "right", render: (row) => row.thruPlays > 0 ? fmtN(row.thruPlays) : "-" },
    { key: "video2SecPlays", label: "2-Sec Video Plays", align: "right", render: (row) => row.video2SecPlays > 0 ? fmtN(row.video2SecPlays) : "-" },
    { key: "costPer2SecPlay", label: "Cost per 2-Sec Play", align: "right", render: (row) => row.costPer2SecPlay > 0 ? fmt$(row.costPer2SecPlay) : "-" },
    { key: "video3SecPlays", label: "3-Sec Video Plays", align: "right", render: (row) => row.video3SecPlays > 0 ? fmtN(row.video3SecPlays) : "-" },
    { key: "costPer3SecPlay", label: "Cost per 3-Sec Play", align: "right", render: (row) => row.costPer3SecPlay > 0 ? fmt$(row.costPer3SecPlay) : "-" },
    { key: "video3SecRate", label: "3-Sec Rate per Impr.", align: "right", render: (row) => row.video3SecRate > 0 ? fmtPct(row.video3SecRate) : "-" },
    { key: "videoAvgPlayTime", label: "Avg Play Time", align: "right", render: (row) => row.videoAvgPlayTime > 0 ? fmtTime(row.videoAvgPlayTime) : "-" },
    { key: "videoP25", label: "Video 25%", align: "right", render: (row) => row.videoP25 > 0 ? fmtN(row.videoP25) : "-" },
    { key: "videoP50", label: "Video 50%", align: "right", render: (row) => row.videoP50 > 0 ? fmtN(row.videoP50) : "-" },
    { key: "videoP75", label: "Video 75%", align: "right", render: (row) => row.videoP75 > 0 ? fmtN(row.videoP75) : "-" },
    { key: "videoP95", label: "Video 95%", align: "right", render: (row) => row.videoP95 > 0 ? fmtN(row.videoP95) : "-" },
    { key: "videoP100", label: "Video 100%", align: "right", render: (row) => row.videoP100 > 0 ? fmtN(row.videoP100) : "-" },
    { key: "qualityRanking", label: "Quality Ranking", align: "left", render: (row) => <RankingBadge value={row.qualityRanking} /> },
    { key: "engagementRateRanking", label: "Engagement Ranking", align: "left", render: (row) => <RankingBadge value={row.engagementRateRanking} /> },
    { key: "conversionRateRanking", label: "Conversion Ranking", align: "left", render: (row) => <RankingBadge value={row.conversionRateRanking} /> },
  ];
}

const ALL_COLUMN_KEYS = buildColumns("campaigns").map(c => c.key);
const STORAGE_KEY = "fb-ads-visible-columns";

function loadVisibleColumns(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
    }
  } catch {}
  return new Set(ALL_COLUMN_KEYS);
}

function saveVisibleColumns(cols: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(cols)));
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className="text-lg font-bold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
          </div>
          <div className="shrink-0 p-2 rounded-md bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FacebookAdsPage() {
  const defaults = getDefaultDates();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [datePreset, setDatePreset] = useState("Last 7 Days");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("campaigns");
  const [breadcrumbs, setBreadcrumbs] = useState<{ level: DrillLevel; id: string; name: string }[]>([]);
  const [currentDrillId, setCurrentDrillId] = useState<string>("");
  const [drilledCampaignId, setDrilledCampaignId] = useState<string>("");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(loadVisibleColumns);

  useEffect(() => {
    saveVisibleColumns(visibleColumns);
  }, [visibleColumns]);

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (key === "name") return next;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery<AdAccount[]>({
    queryKey: ["/api/facebook/ad-accounts"],
  });

  const selectedAccountObj = accounts?.find(a => a.id === selectedAccount);
  const accountTz = selectedAccountObj?.timezone_name;

  const applyPreset = (preset: typeof FB_DATE_PRESETS[number]) => {
    const { start, end } = preset.getRange();
    setStartDate(toTzDateStr(start, accountTz));
    setEndDate(toTzDateStr(end, accountTz));
    setDatePreset(preset.label);
    setDatePickerOpen(false);
  };

  const { data: accountInsights, isLoading: summaryLoading } = useQuery<NormalizedInsight[]>({
    queryKey: ["/api/facebook/account-insights", selectedAccount, startDate, endDate],
    enabled: !!selectedAccount,
    queryFn: async () => {
      const res = await fetch(`/api/facebook/account-insights?adAccountId=${selectedAccount}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<NormalizedInsight[]>({
    queryKey: ["/api/facebook/campaigns", selectedAccount, startDate, endDate],
    enabled: !!selectedAccount && drillLevel === "campaigns",
    queryFn: async () => {
      const res = await fetch(`/api/facebook/campaigns?adAccountId=${selectedAccount}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: adsets, isLoading: adsetsLoading } = useQuery<NormalizedInsight[]>({
    queryKey: ["/api/facebook/adsets", selectedAccount, currentDrillId, startDate, endDate],
    enabled: drillLevel === "adsets" && !!currentDrillId && !!selectedAccount,
    queryFn: async () => {
      const res = await fetch(`/api/facebook/adsets?adAccountId=${selectedAccount}&campaignId=${currentDrillId}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: ads, isLoading: adsLoading } = useQuery<NormalizedInsight[]>({
    queryKey: ["/api/facebook/ads", selectedAccount, currentDrillId, startDate, endDate],
    enabled: drillLevel === "ads" && !!currentDrillId && !!selectedAccount,
    queryFn: async () => {
      const res = await fetch(`/api/facebook/ads?adAccountId=${selectedAccount}&adsetId=${currentDrillId}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const summary = accountInsights?.[0];

  const currentData = useMemo(() => {
    const raw = drillLevel === "campaigns" ? campaigns : drillLevel === "adsets" ? adsets : ads;
    if (!raw) return [];
    return [...raw].sort((a, b) => b.spend - a.spend);
  }, [drillLevel, campaigns, adsets, ads]);

  const isTableLoading = drillLevel === "campaigns" ? campaignsLoading : drillLevel === "adsets" ? adsetsLoading : adsLoading;

  const columns = useMemo(() => buildColumns(drillLevel), [drillLevel]);
  const allColumnDefs = useMemo(() => buildColumns("campaigns"), []);
  const visibleCols = useMemo(() => columns.filter(c => visibleColumns.has(c.key)), [columns, visibleColumns]);

  const drillIntoCampaign = (campaignId: string, campaignName: string) => {
    setDrilledCampaignId(campaignId);
    setCurrentDrillId(campaignId);
    setDrillLevel("adsets");
    setBreadcrumbs([
      { level: "campaigns", id: selectedAccount, name: accounts?.find(a => a.id === selectedAccount)?.name || selectedAccount },
      { level: "adsets", id: campaignId, name: campaignName },
    ]);
  };

  const drillIntoAdset = (adsetId: string, adsetName: string) => {
    setCurrentDrillId(adsetId);
    setDrillLevel("ads");
    setBreadcrumbs(prev => [...prev, { level: "ads", id: adsetId, name: adsetName }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === 0) {
      setDrillLevel("campaigns");
      setCurrentDrillId("");
      setBreadcrumbs([]);
    } else {
      const bc = breadcrumbs[index];
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      setCurrentDrillId(bc.id);
      setDrillLevel(bc.level);
    }
  };

  const getRowKey = (row: NormalizedInsight) => {
    if (drillLevel === "campaigns") return row.campaignId || "";
    if (drillLevel === "adsets") return row.adsetId || "";
    return row.adId || "";
  };

  const getRowName = (row: NormalizedInsight) => {
    if (drillLevel === "campaigns") return row.campaignName || row.campaignId || "";
    if (drillLevel === "adsets") return row.adsetName || row.adsetId || "";
    return row.adName || row.adId || "";
  };

  const onRowClick = (row: NormalizedInsight) => {
    if (drillLevel === "campaigns") {
      drillIntoCampaign(row.campaignId!, row.campaignName || row.campaignId!);
    } else if (drillLevel === "adsets") {
      drillIntoAdset(row.adsetId!, row.adsetName || row.adsetId!);
    }
  };

  const canDrill = drillLevel !== "ads";

  return (
    <div className="p-3 space-y-3" data-testid="page-facebook-ads">
      <div className="flex items-center gap-2 flex-wrap">
        <SiFacebook className="w-5 h-5 text-[#1877F2]" />
        <h1 className="text-base font-bold">Facebook Ads</h1>
        <Badge variant="outline" className="text-[9px] no-default-hover-elevate no-default-active-elevate">Meta Marketing API v24.0</Badge>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Ad Account</label>
              {accountsLoading ? (
                <Skeleton className="h-9 w-[240px]" />
              ) : accountsError ? (
                <p className="text-[10px] text-destructive">Failed to load accounts. Check your access token.</p>
              ) : (
                <Select value={selectedAccount} onValueChange={(v) => {
                  setSelectedAccount(v);
                  setDrillLevel("campaigns");
                  setBreadcrumbs([]);
                  setCurrentDrillId("");
                  setDrilledCampaignId("");
                  const acct = accounts?.find(a => a.id === v);
                  if (acct?.timezone_name) {
                    const d = getDefaultDates(acct.timezone_name);
                    setStartDate(d.startDate);
                    setEndDate(d.endDate);
                  }
                }}>
                  <SelectTrigger className="w-[280px]" data-testid="select-ad-account">
                    <SelectValue placeholder="Select ad account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id} data-testid={`option-account-${acc.account_id}`}>
                        <span className="text-[11px]">{acc.name} ({acc.account_id})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">
                Date Range{accountTz && <span className="normal-case ml-1" data-testid="text-account-timezone">({accountTz})</span>}
              </label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start text-left font-normal gap-2 min-w-[240px]"
                    data-testid="button-date-range"
                  >
                    <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px]">
                      {datePreset !== "Custom"
                        ? datePreset
                        : `${format(new Date(startDate + "T00:00:00"), "MMM d, yyyy")} - ${format(new Date(endDate + "T00:00:00"), "MMM d, yyyy")}`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex">
                    <div className="border-r p-2 space-y-0.5 min-w-[140px]">
                      {FB_DATE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          data-testid={`btn-preset-${preset.label.toLowerCase().replace(/\s/g, "-")}`}
                          className={`w-full text-left text-[11px] px-3 py-1.5 rounded-md transition-colors ${
                            datePreset === preset.label
                              ? "bg-primary text-primary-foreground"
                              : "hover-elevate"
                          }`}
                          onClick={() => applyPreset(preset)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="p-2">
                      <Calendar
                        mode="range"
                        selected={{
                          from: new Date(startDate + "T00:00:00"),
                          to: new Date(endDate + "T00:00:00"),
                        }}
                        onSelect={(range) => {
                          if (range?.from) {
                            setStartDate(toTzDateStr(range.from, accountTz));
                            setEndDate(toTzDateStr(range.to || range.from, accountTz));
                            setDatePreset("Custom");
                          }
                        }}
                        numberOfMonths={2}
                        data-testid="calendar-date-range"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" data-testid="button-columns">
                  <Columns3 className="w-3.5 h-3.5 mr-1.5" />
                  <span className="text-[11px]">Columns</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Customize Columns</SheetTitle>
                </SheetHeader>
                <div className="mt-4 flex gap-2 mb-3">
                  <Button variant="outline" size="sm" onClick={() => setVisibleColumns(new Set(ALL_COLUMN_KEYS))} data-testid="button-show-all-columns">
                    <span className="text-[11px]">Show All</span>
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setVisibleColumns(new Set(["name"]))} data-testid="button-hide-all-columns">
                    <span className="text-[11px]">Hide All</span>
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100vh-10rem)]">
                  <div className="space-y-1 pr-4">
                    {allColumnDefs.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover-elevate cursor-pointer"
                        data-testid={`column-toggle-${col.key}`}
                      >
                        <Checkbox
                          checked={visibleColumns.has(col.key)}
                          onCheckedChange={() => toggleColumn(col.key)}
                          disabled={col.key === "name"}
                        />
                        <span className="text-[11px] flex-1">{col.label}</span>
                        {col.isCustom && (
                          <Badge variant="secondary" className="text-[8px] no-default-hover-elevate no-default-active-elevate">Custom</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </CardContent>
      </Card>

      {selectedAccount && summary && !summaryLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <StatCard label="Total Spend" value={fmt$(summary.spend)} icon={DollarSign} />
          <StatCard label="Impressions" value={fmtN(summary.impressions)} icon={Eye} />
          <StatCard label="Reach" value={fmtN(summary.reach)} icon={Users} />
          <StatCard label="Clicks" value={fmtN(summary.clicks)} icon={MousePointerClick} />
          <StatCard label="CTR" value={fmtPct(summary.ctr)} icon={TrendingUp} />
          <StatCard label="Leads" value={fmtN(summary.leads)} icon={Target} />
          <StatCard label="CPL" value={summary.leads > 0 ? fmt$(summary.spend / summary.leads) : "-"} icon={DollarSign} />
          <StatCard label="Link Clicks" value={summary.linkClicks > 0 ? fmtN(summary.linkClicks) : "-"} icon={Link2} />
        </div>
      )}

      {selectedAccount && summaryLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      )}

      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-[11px] flex-wrap" data-testid="breadcrumbs">
          <button
            className="text-primary font-medium hover-elevate px-1.5 py-0.5 rounded-md"
            onClick={() => navigateToBreadcrumb(0)}
            data-testid="breadcrumb-campaigns"
          >
            Campaigns
          </button>
          {breadcrumbs.slice(1).map((bc, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <button
                className={`px-1.5 py-0.5 rounded-md ${i === breadcrumbs.length - 2 ? "font-medium text-foreground" : "text-primary font-medium hover-elevate"}`}
                onClick={() => navigateToBreadcrumb(i + 1)}
                data-testid={`breadcrumb-${bc.level}-${bc.id}`}
              >
                {bc.name}
              </button>
            </span>
          ))}
        </div>
      )}

      {selectedAccount && (
        <div className="overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {visibleCols.map((col, ci) => (
                  <TableHead
                    key={col.key}
                    className={`text-[10px] font-semibold py-1 px-2 whitespace-nowrap ${ci === 0 ? "sticky left-0 bg-background z-20" : ""} ${col.align === "right" ? "text-right" : ""}`}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {col.isCustom && <Badge variant="secondary" className="text-[7px] px-1 py-0 no-default-hover-elevate no-default-active-elevate">C</Badge>}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isTableLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {visibleCols.map((col, ci) => (
                      <TableCell key={col.key} className={`py-1 px-2 ${ci === 0 ? "sticky left-0 bg-background z-10" : ""}`}>
                        <Skeleton className="h-4 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleCols.length} className="text-center text-[10px] text-muted-foreground py-8">
                    No data for this period.
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((row) => {
                  const rowKey = getRowKey(row);
                  return (
                    <TableRow
                      key={rowKey}
                      className={canDrill ? "cursor-pointer hover-elevate" : ""}
                      onClick={canDrill ? () => onRowClick(row) : undefined}
                      data-testid={`row-${drillLevel.slice(0, -1)}-${rowKey}`}
                    >
                      {visibleCols.map((col, ci) => (
                        <TableCell
                          key={col.key}
                          className={`text-[10px] py-1 px-2 tabular-nums ${ci === 0 ? "sticky left-0 bg-background z-10 max-w-[200px]" : ""} ${col.align === "right" ? "text-right" : ""} ${col.key === "amountSpent" || col.key === "budget" ? "font-medium" : ""}`}
                        >
                          {ci === 0 ? (
                            <div className="flex items-center gap-1">
                              {canDrill && <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                              <span className="truncate font-medium">{col.render(row)}</span>
                            </div>
                          ) : (
                            col.render(row)
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!selectedAccount && !accountsLoading && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Select an ad account to view campaign data.</p>
        </div>
      )}
    </div>
  );
}