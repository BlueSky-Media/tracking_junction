import DOMPurify from "dompurify";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowUp, ArrowDown, BarChart3, Calendar as CalendarIcon, Brain, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, parseISO, differenceInDays } from "date-fns";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

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

const CHART_BLUE = "hsl(220, 70%, 55%)";
const CHART_GREEN = "hsl(142, 71%, 45%)";
const CHART_ORANGE = "hsl(24, 95%, 53%)";
const CHART_PURPLE = "hsl(271, 91%, 65%)";

function fmt$(v: number) { return "$" + v.toFixed(2); }
function fmtN(v: number) { return v.toLocaleString(); }
function fmtPct(v: number) { return v.toFixed(2) + "%"; }

function toTzDateStr(d: Date, tz?: string): string {
  if (tz) {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
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

const DATE_PRESETS: { label: string; getRange: () => { start: Date; end: Date } }[] = [
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

interface DailyAgg {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
  linkClicks: number;
  ctr: number;
  outboundCtr: number;
  costPerLead: number;
  landingPageConversionRate: number;
}

function aggregateDaily(insights: NormalizedInsight[]): DailyAgg[] {
  const map = new Map<string, NormalizedInsight[]>();
  for (const row of insights) {
    const key = row.dateStart;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  const result: DailyAgg[] = [];
  const entries = Array.from(map.entries());
  for (const [date, rows] of entries) {
    const n = rows.length;
    result.push({
      date,
      spend: rows.reduce((s: number, r: NormalizedInsight) => s + r.spend, 0),
      impressions: rows.reduce((s: number, r: NormalizedInsight) => s + r.impressions, 0),
      reach: rows.reduce((s: number, r: NormalizedInsight) => s + r.reach, 0),
      clicks: rows.reduce((s: number, r: NormalizedInsight) => s + r.clicks, 0),
      leads: rows.reduce((s: number, r: NormalizedInsight) => s + r.leads, 0),
      linkClicks: rows.reduce((s: number, r: NormalizedInsight) => s + r.linkClicks, 0),
      ctr: rows.reduce((s: number, r: NormalizedInsight) => s + r.ctr, 0) / n,
      outboundCtr: rows.reduce((s: number, r: NormalizedInsight) => s + r.outboundCtr, 0) / n,
      costPerLead: rows.reduce((s: number, r: NormalizedInsight) => s + r.costPerLead, 0) / n,
      landingPageConversionRate: rows.reduce((s: number, r: NormalizedInsight) => s + r.landingPageConversionRate, 0) / n,
    });
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function formatDateLabel(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MM/dd");
  } catch {
    return dateStr;
  }
}

const COMPARISON_METRICS = [
  { value: "spend", label: "Spend", fmt: fmt$ },
  { value: "costPerLead", label: "CPL", fmt: fmt$ },
  { value: "ctr", label: "CTR", fmt: fmtPct },
  { value: "leads", label: "Leads", fmt: fmtN },
  { value: "linkClicks", label: "Link Clicks", fmt: fmtN },
  { value: "impressions", label: "Impressions", fmt: fmtN },
  { value: "landingPageConversionRate", label: "Conversion Rate", fmt: fmtPct },
  { value: "outboundCtr", label: "Outbound CTR", fmt: fmtPct },
];

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[250px] w-full" />
      </CardContent>
    </Card>
  );
}

function KpiSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <Skeleton className="h-3 w-20 mb-2" />
        <Skeleton className="h-6 w-24" />
      </CardContent>
    </Card>
  );
}

export default function AdMetricsPage() {
  const defaults = getDefaultDates();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [datePreset, setDatePreset] = useState("Last 7 Days");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("trends");
  const [comparisonMetric, setComparisonMetric] = useState("spend");
  const [allCampaigns, setAllCampaigns] = useState(true);
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [aiInsights, setAiInsights] = useState<string>("");
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsLoaded, setInsightsLoaded] = useState(false);

  const { data: accounts, isLoading: accountsLoading } = useQuery<AdAccount[]>({
    queryKey: ["/api/facebook/ad-accounts"],
  });

  const selectedAccountObj = accounts?.find(a => a.id === selectedAccount);
  const accountTz = selectedAccountObj?.timezone_name;

  const applyPreset = (preset: typeof DATE_PRESETS[number]) => {
    const { start, end } = preset.getRange();
    setStartDate(toTzDateStr(start, accountTz));
    setEndDate(toTzDateStr(end, accountTz));
    setDatePreset(preset.label);
    setDatePickerOpen(false);
  };

  const { data: dailyInsights, isLoading: dailyLoading } = useQuery<NormalizedInsight[]>({
    queryKey: ["/api/facebook/daily-campaign-insights", selectedAccount, startDate, endDate],
    enabled: !!selectedAccount,
    queryFn: async () => {
      const res = await fetch(`/api/facebook/daily-campaign-insights?adAccountId=${selectedAccount}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: campaignData, isLoading: campaignsLoading } = useQuery<NormalizedInsight[]>({
    queryKey: ["/api/facebook/campaigns", selectedAccount, startDate, endDate],
    enabled: !!selectedAccount,
    queryFn: async () => {
      const res = await fetch(`/api/facebook/campaigns?adAccountId=${selectedAccount}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const uniqueCampaigns = useMemo(() => {
    if (!dailyInsights) return [];
    const seen = new Map<string, string>();
    for (const row of dailyInsights) {
      if (row.campaignId && !seen.has(row.campaignId)) {
        seen.set(row.campaignId, row.campaignName || row.campaignId);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [dailyInsights]);

  const filteredDailyInsights = useMemo(() => {
    if (!dailyInsights) return [];
    if (allCampaigns) return dailyInsights;
    return dailyInsights.filter(r => r.campaignId && selectedCampaigns.has(r.campaignId));
  }, [dailyInsights, allCampaigns, selectedCampaigns]);

  const dailyData = useMemo(() => aggregateDaily(filteredDailyInsights), [filteredDailyInsights]);

  const sortedCampaigns = useMemo(() => {
    if (!campaignData) return [];
    return [...campaignData].sort((a, b) => b.spend - a.spend);
  }, [campaignData]);

  const comparisonChartData = useMemo(() => {
    return sortedCampaigns.map(c => ({
      name: c.campaignName || c.campaignId || "Unknown",
      value: (c as any)[comparisonMetric] || 0,
    }));
  }, [sortedCampaigns, comparisonMetric]);

  const summaryAgg = useMemo(() => {
    const src = filteredDailyInsights.length > 0 ? filteredDailyInsights : [];
    if (src.length === 0) return null;
    const totalSpend = src.reduce((s, r) => s + r.spend, 0);
    const totalImpressions = src.reduce((s, r) => s + r.impressions, 0);
    const totalReach = src.reduce((s, r) => s + r.reach, 0);
    const totalClicks = src.reduce((s, r) => s + r.clicks, 0);
    const totalLeads = src.reduce((s, r) => s + r.leads, 0);
    const totalLinkClicks = src.reduce((s, r) => s + r.linkClicks, 0);
    const totalOutboundClicks = src.reduce((s, r) => s + r.outboundClicks, 0);
    const n = src.length;
    return {
      totalSpend,
      totalImpressions,
      totalReach,
      totalClicks,
      avgCtr: src.reduce((s, r) => s + r.ctr, 0) / n,
      totalLeads,
      avgCpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      totalLinkClicks,
      avgConvRate: src.reduce((s, r) => s + r.landingPageConversionRate, 0) / n,
      totalOutboundClicks,
      avgOutboundCtr: src.reduce((s, r) => s + r.outboundCtr, 0) / n,
      avgFrequency: src.reduce((s, r) => s + r.frequency, 0) / n,
    };
  }, [filteredDailyInsights]);

  const periodComparison = useMemo(() => {
    if (!dailyData || dailyData.length === 0) return null;
    const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    if (days < 14) return null;
    const midIndex = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, midIndex);
    const secondHalf = dailyData.slice(midIndex);
    if (firstHalf.length === 0 || secondHalf.length === 0) return null;

    const agg = (arr: DailyAgg[]) => ({
      spend: arr.reduce((s, r) => s + r.spend, 0),
      leads: arr.reduce((s, r) => s + r.leads, 0),
      clicks: arr.reduce((s, r) => s + r.clicks, 0),
      impressions: arr.reduce((s, r) => s + r.impressions, 0),
      ctr: arr.reduce((s, r) => s + r.ctr, 0) / arr.length,
      costPerLead: arr.reduce((s, r) => s + r.costPerLead, 0) / arr.length,
      convRate: arr.reduce((s, r) => s + r.landingPageConversionRate, 0) / arr.length,
    });

    const first = agg(firstHalf);
    const second = agg(secondHalf);

    const pctChange = (a: number, b: number) => a === 0 ? 0 : ((b - a) / a) * 100;

    return {
      firstLabel: `${formatDateLabel(firstHalf[0].date)} - ${formatDateLabel(firstHalf[firstHalf.length - 1].date)}`,
      secondLabel: `${formatDateLabel(secondHalf[0].date)} - ${formatDateLabel(secondHalf[secondHalf.length - 1].date)}`,
      metrics: [
        { label: "Spend", first: fmt$(first.spend), second: fmt$(second.spend), change: pctChange(first.spend, second.spend), invertColor: true },
        { label: "Leads", first: fmtN(first.leads), second: fmtN(second.leads), change: pctChange(first.leads, second.leads), invertColor: false },
        { label: "Clicks", first: fmtN(first.clicks), second: fmtN(second.clicks), change: pctChange(first.clicks, second.clicks), invertColor: false },
        { label: "CTR", first: fmtPct(first.ctr), second: fmtPct(second.ctr), change: pctChange(first.ctr, second.ctr), invertColor: false },
        { label: "CPL", first: fmt$(first.costPerLead), second: fmt$(second.costPerLead), change: pctChange(first.costPerLead, second.costPerLead), invertColor: true },
        { label: "Conv. Rate", first: fmtPct(first.convRate), second: fmtPct(second.convRate), change: pctChange(first.convRate, second.convRate), invertColor: false },
      ],
    };
  }, [dailyData, startDate, endDate]);

  const metricFmt = COMPARISON_METRICS.find(m => m.value === comparisonMetric)?.fmt || fmtN;

  const loadAiInsights = async () => {
    if (!campaignData || campaignData.length === 0) return;
    setInsightsLoading(true);
    try {
      const dataLines = campaignData.map(c =>
        `Campaign: ${c.campaignName || c.campaignId} | Spend: $${c.spend.toFixed(2)} | Impr: ${c.impressions} | Clicks: ${c.clicks} | CTR: ${c.ctr.toFixed(2)}% | Leads: ${c.leads} | CPL: $${c.costPerLead.toFixed(2)} | Link Clicks: ${c.linkClicks} | Conv Rate: ${c.landingPageConversionRate.toFixed(2)}% | Reach: ${c.reach} | Freq: ${c.frequency.toFixed(2)} | Quality: ${c.qualityRanking} | Engagement: ${c.engagementRateRanking} | Conversion: ${c.conversionRateRanking}`
      ).join("\n");
      const context = `Date Range: ${startDate} to ${endDate}\nTotal Campaigns: ${campaignData.length}\n\n${dataLines}`;
      const resp = await fetch("/api/chat/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataContext: context }),
      });
      if (!resp.ok) throw new Error("Failed to generate insights");
      const { insights } = await resp.json();
      setAiInsights(insights);
      setInsightsLoaded(true);
      setInsightsExpanded(true);
    } catch (err) {
      console.error("AI insights error:", err);
      setAiInsights("Unable to generate insights at this time. Please try again.");
      setInsightsLoaded(true);
      setInsightsExpanded(true);
    } finally {
      setInsightsLoading(false);
    }
  };

  const toggleCampaign = (id: string) => {
    setSelectedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-3 space-y-3" data-testid="page-ad-metrics">
      <div className="flex items-center gap-2 flex-wrap">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h1 className="text-base font-bold">Ad Metrics Reporting</h1>
      </div>

      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Ad Account</label>
          {accountsLoading ? (
            <Skeleton className="h-9 w-[240px]" />
          ) : (
            <Select value={selectedAccount} onValueChange={(v) => {
              setSelectedAccount(v);
              setAllCampaigns(true);
              setSelectedCampaigns(new Set());
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
            Date Range{accountTz && <span className="normal-case ml-1">({accountTz})</span>}
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
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                <div className="border-r p-2 space-y-0.5 min-w-[140px]">
                  {DATE_PRESETS.map((preset) => (
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

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Campaigns</label>
          <Select
            value={allCampaigns ? "all" : "selected"}
            onValueChange={(v) => {
              if (v === "all") {
                setAllCampaigns(true);
                setSelectedCampaigns(new Set());
              } else {
                setAllCampaigns(false);
              }
            }}
            data-testid="select-campaign-filter"
          >
            <SelectTrigger className="w-[180px]" data-testid="select-campaign-filter-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value="selected">Select Campaigns</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {!allCampaigns && uniqueCampaigns.length > 0 && (
          <div className="flex gap-1 flex-wrap items-center">
            {uniqueCampaigns.map(c => (
              <Button
                key={c.id}
                variant={selectedCampaigns.has(c.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleCampaign(c.id)}
                data-testid={`btn-campaign-${c.id}`}
              >
                <span className="text-[10px] truncate max-w-[120px]">{c.name}</span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {!selectedAccount ? (
        <Card>
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Select an ad account to view metrics</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList data-testid="tabs-metrics">
            <TabsTrigger value="trends" data-testid="tab-trends">Trend Charts</TabsTrigger>
            <TabsTrigger value="comparison" data-testid="tab-comparison">Campaign Comparison</TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary">Performance Summary</TabsTrigger>
          </TabsList>

          <TabsContent value="trends" className="mt-3">
            {dailyLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <ChartSkeleton key={i} />)}
              </div>
            ) : dailyData.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No data available for the selected period</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Daily Spend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => "$" + v} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmt$(v)} labelFormatter={formatDateLabel} />
                        <Area type="monotone" dataKey="spend" stroke={CHART_BLUE} fill={CHART_BLUE} fillOpacity={0.3} name="Spend" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">CTR & Outbound CTR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => v + "%"} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmtPct(v)} labelFormatter={formatDateLabel} />
                        <Legend />
                        <Line type="monotone" dataKey="ctr" stroke={CHART_BLUE} name="CTR" dot={false} />
                        <Line type="monotone" dataKey="outboundCtr" stroke={CHART_GREEN} name="Outbound CTR" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cost Per Lead</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => "$" + v} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmt$(v)} labelFormatter={formatDateLabel} />
                        <Line type="monotone" dataKey="costPerLead" stroke={CHART_ORANGE} name="CPL" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Leads & Link Clicks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmtN(v)} labelFormatter={formatDateLabel} />
                        <Legend />
                        <Bar dataKey="leads" fill={CHART_GREEN} name="Leads" />
                        <Bar dataKey="linkClicks" fill={CHART_BLUE} name="Link Clicks" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Impressions & Reach</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => fmtN(v)} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmtN(v)} labelFormatter={formatDateLabel} />
                        <Legend />
                        <Area type="monotone" dataKey="impressions" stroke={CHART_BLUE} fill={CHART_BLUE} fillOpacity={0.3} name="Impressions" stackId="1" />
                        <Area type="monotone" dataKey="reach" stroke={CHART_GREEN} fill={CHART_GREEN} fillOpacity={0.3} name="Reach" stackId="1" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Landing Page Conversion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => v + "%"} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fmtPct(v)} labelFormatter={formatDateLabel} />
                        <Line type="monotone" dataKey="landingPageConversionRate" stroke={CHART_PURPLE} name="Conv. Rate" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="comparison" className="mt-3 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Metric</label>
              <Select value={comparisonMetric} onValueChange={setComparisonMetric}>
                <SelectTrigger className="w-[200px]" data-testid="select-comparison-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISON_METRICS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {campaignsLoading ? (
              <ChartSkeleton />
            ) : comparisonChartData.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No campaign data available</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Campaign Comparison - {COMPARISON_METRICS.find(m => m.value === comparisonMetric)?.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(250, comparisonChartData.length * 40)}>
                    <BarChart data={comparisonChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => metricFmt(v)} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => metricFmt(v)} />
                      <Bar dataKey="value" fill={CHART_BLUE} name={COMPARISON_METRICS.find(m => m.value === comparisonMetric)?.label} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {campaignsLoading ? (
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-[200px] w-full" />
                </CardContent>
              </Card>
            ) : sortedCampaigns.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Campaign Details</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Campaign Name</TableHead>
                          <TableHead className="text-[10px] text-right">Spend</TableHead>
                          <TableHead className="text-[10px] text-right">Impressions</TableHead>
                          <TableHead className="text-[10px] text-right">Clicks</TableHead>
                          <TableHead className="text-[10px] text-right">CTR</TableHead>
                          <TableHead className="text-[10px] text-right">Leads</TableHead>
                          <TableHead className="text-[10px] text-right">CPL</TableHead>
                          <TableHead className="text-[10px] text-right">Link Clicks</TableHead>
                          <TableHead className="text-[10px] text-right">Conv. Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCampaigns.map((c, i) => (
                          <TableRow key={c.campaignId || i} data-testid={`row-campaign-${c.campaignId || i}`}>
                            <TableCell className="text-[11px] font-medium max-w-[200px] truncate">{c.campaignName || c.campaignId || "-"}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{fmt$(c.spend)}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{fmtN(c.impressions)}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{fmtN(c.clicks)}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{fmtPct(c.ctr)}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{c.leads > 0 ? fmtN(c.leads) : "-"}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{c.leads > 0 ? fmt$(c.spend / c.leads) : "-"}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{c.linkClicks > 0 ? fmtN(c.linkClicks) : "-"}</TableCell>
                            <TableCell className="text-[11px] text-right tabular-nums">{fmtPct(c.landingPageConversionRate)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="summary" className="mt-3 space-y-3">
            {dailyLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => <KpiSkeleton key={i} />)}
              </div>
            ) : !summaryAgg ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">No data available</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Total Spend", value: fmt$(summaryAgg.totalSpend) },
                    { label: "Total Impressions", value: fmtN(summaryAgg.totalImpressions) },
                    { label: "Total Reach", value: fmtN(summaryAgg.totalReach) },
                    { label: "Total Clicks", value: fmtN(summaryAgg.totalClicks) },
                    { label: "Avg CTR", value: fmtPct(summaryAgg.avgCtr) },
                    { label: "Total Leads", value: fmtN(summaryAgg.totalLeads) },
                    { label: "Avg CPL", value: fmt$(summaryAgg.avgCpl) },
                    { label: "Total Link Clicks", value: fmtN(summaryAgg.totalLinkClicks) },
                    { label: "Avg Conv. Rate", value: fmtPct(summaryAgg.avgConvRate) },
                    { label: "Total Outbound Clicks", value: fmtN(summaryAgg.totalOutboundClicks) },
                    { label: "Avg Outbound CTR", value: fmtPct(summaryAgg.avgOutboundCtr) },
                    { label: "Avg Frequency", value: summaryAgg.avgFrequency.toFixed(2) },
                  ].map((kpi) => (
                    <Card key={kpi.label}>
                      <CardContent className="p-4">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                        <p className="text-lg font-bold tabular-nums mt-1" data-testid={`kpi-${kpi.label.toLowerCase().replace(/\s/g, "-")}`}>{kpi.value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Brain className="w-4 h-4 text-primary" />
                        <CardTitle className="text-sm">AI Performance Insights</CardTitle>
                        {insightsLoaded && <Badge variant="secondary" className="text-[10px]">Generated</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        {!insightsLoaded && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={loadAiInsights}
                            disabled={insightsLoading || !campaignData || campaignData.length === 0}
                            data-testid="button-generate-insights"
                          >
                            {insightsLoading && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                            {insightsLoading ? "Analyzing..." : "Generate Insights"}
                          </Button>
                        )}
                        {insightsLoaded && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setInsightsExpanded(!insightsExpanded)}
                            data-testid="button-toggle-insights"
                          >
                            {insightsExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {insightsLoading && (
                    <CardContent className="pt-0 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  )}
                  {insightsLoaded && insightsExpanded && (
                    <CardContent className="pt-0">
                      <div
                        className="text-sm text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: DOMPurify.sanitize(
                            aiInsights
                              .replace(/```([\s\S]*?)```/g, '<pre class="bg-muted/50 rounded-md p-2 my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/^\s*#{3}\s+(.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')
                              .replace(/^\s*#{2}\s+(.+)$/gm, '<h2 class="font-semibold text-base mt-3 mb-1">$1</h2>')
                              .replace(/^\s*#{1}\s+(.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-1">$1</h1>')
                              .replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
                              .replace(/\n/g, '<br/>'),
                            { ALLOWED_TAGS: ['pre', 'code', 'strong', 'h1', 'h2', 'h3', 'li', 'ul', 'br', 'p', 'div', 'span'], ALLOWED_ATTR: ['class'] }
                          )
                        }}
                        data-testid="text-ai-insights"
                      />
                      <div className="mt-2 flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setInsightsLoaded(false); setAiInsights(""); loadAiInsights(); }}
                          disabled={insightsLoading}
                          data-testid="button-refresh-insights"
                        >
                          Refresh Insights
                        </Button>
                      </div>
                    </CardContent>
                  )}
                  {!insightsLoaded && !insightsLoading && (
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">Click "Generate Insights" to get AI-powered analysis of your campaign performance data.</p>
                    </CardContent>
                  )}
                </Card>

                {periodComparison && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Period over Period Comparison</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Metric</TableHead>
                              <TableHead className="text-[10px] text-right">{periodComparison.firstLabel}</TableHead>
                              <TableHead className="text-[10px] text-right">{periodComparison.secondLabel}</TableHead>
                              <TableHead className="text-[10px] text-right">Change</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {periodComparison.metrics.map((m) => {
                              const isPositive = m.change > 0;
                              const isImproved = m.invertColor ? !isPositive : isPositive;
                              return (
                                <TableRow key={m.label}>
                                  <TableCell className="text-[11px] font-medium">{m.label}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums">{m.first}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums">{m.second}</TableCell>
                                  <TableCell className="text-[11px] text-right tabular-nums">
                                    <span className={`inline-flex items-center gap-0.5 ${isImproved ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                                      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                      {Math.abs(m.change).toFixed(1)}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
