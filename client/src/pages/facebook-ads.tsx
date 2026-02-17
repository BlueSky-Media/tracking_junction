import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RefreshCw, ChevronRight, ChevronDown, TrendingUp, DollarSign, Eye, MousePointerClick, Users, ArrowLeft, CalendarIcon } from "lucide-react";
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

function fmt$(v: number) {
  return "$" + v.toFixed(2);
}
function fmtN(v: number) {
  return v.toLocaleString();
}
function fmtPct(v: number) {
  return v.toFixed(2) + "%";
}

function toTzDateStr(d: Date, tz?: string): string {
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      return parts;
    } catch {}
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDefaultDates(tz?: string) {
  const now = new Date();
  const end = toTzDateStr(now, tz);
  const start = new Date(now.getTime() - 7 * 86400000);
  return {
    startDate: toTzDateStr(start, tz),
    endDate: end,
  };
}

const FB_DATE_PRESETS: { label: string; getRange: (tz?: string) => { start: Date; end: Date } }[] = [
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

function StatCard({ label, value, icon: Icon, sub }: { label: string; value: string; icon: any; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{label}</p>
            <p className="text-lg font-bold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
          </div>
          <div className="shrink-0 p-2 rounded-md bg-primary/10">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignTable({ data, onDrill }: { data: NormalizedInsight[]; onDrill: (id: string, name: string) => void }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.spend - a.spend), [data]);

  if (sorted.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-4">No campaign data for this period.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap sticky left-0 bg-background z-10">Campaign</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Spend</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Impr.</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Reach</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Clicks</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CTR</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPC</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPM</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Freq.</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Leads</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPL</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Link Clicks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.campaignId}
              className="cursor-pointer hover-elevate"
              onClick={() => onDrill(row.campaignId!, row.campaignName || row.campaignId!)}
              data-testid={`row-campaign-${row.campaignId}`}
            >
              <TableCell className="text-[10px] py-1 px-2 max-w-[200px] truncate sticky left-0 bg-background z-10">
                <div className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{row.campaignName || row.campaignId}</span>
                </div>
              </TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums font-medium">{fmt$(row.spend)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.impressions)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.reach)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.clicks)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtPct(row.ctr)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmt$(row.cpc)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmt$(row.cpm)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.frequency.toFixed(2)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.leads > 0 ? fmtN(row.leads) : "-"}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.costPerLead > 0 ? fmt$(row.costPerLead) : "-"}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.linkClicks > 0 ? fmtN(row.linkClicks) : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdsetTable({ data, onDrill }: { data: NormalizedInsight[]; onDrill: (id: string, name: string) => void }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.spend - a.spend), [data]);

  if (sorted.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-4">No ad set data for this period.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap sticky left-0 bg-background z-10">Ad Set</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Spend</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Impr.</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Reach</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Clicks</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CTR</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPC</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPM</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Leads</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow
              key={row.adsetId}
              className="cursor-pointer hover-elevate"
              onClick={() => onDrill(row.adsetId!, row.adsetName || row.adsetId!)}
              data-testid={`row-adset-${row.adsetId}`}
            >
              <TableCell className="text-[10px] py-1 px-2 max-w-[200px] truncate sticky left-0 bg-background z-10">
                <div className="flex items-center gap-1">
                  <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{row.adsetName || row.adsetId}</span>
                </div>
              </TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums font-medium">{fmt$(row.spend)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.impressions)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.reach)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.clicks)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtPct(row.ctr)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmt$(row.cpc)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmt$(row.cpm)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.leads > 0 ? fmtN(row.leads) : "-"}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.costPerLead > 0 ? fmt$(row.costPerLead) : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdTable({ data }: { data: NormalizedInsight[] }) {
  const sorted = useMemo(() => [...data].sort((a, b) => b.spend - a.spend), [data]);

  if (sorted.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-4">No ad data for this period.</p>;
  }

  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-[10px] font-semibold py-1 px-2 whitespace-nowrap sticky left-0 bg-background z-10">Ad</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Spend</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Impr.</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Reach</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Clicks</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CTR</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPC</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPM</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">Leads</TableHead>
            <TableHead className="text-[10px] font-semibold py-1 px-2 text-right whitespace-nowrap">CPL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.adId} data-testid={`row-ad-${row.adId}`}>
              <TableCell className="text-[10px] py-1 px-2 max-w-[200px] truncate sticky left-0 bg-background z-10">
                <span className="truncate font-medium">{row.adName || row.adId}</span>
              </TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums font-medium">{fmt$(row.spend)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.impressions)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.reach)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtN(row.clicks)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmtPct(row.ctr)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmt$(row.cpc)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{fmt$(row.cpm)}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.leads > 0 ? fmtN(row.leads) : "-"}</TableCell>
              <TableCell className="text-[10px] py-1 px-2 text-right tabular-nums">{row.costPerLead > 0 ? fmt$(row.costPerLead) : "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type DrillLevel = "campaigns" | "adsets" | "ads";

interface Breadcrumb {
  level: DrillLevel;
  id: string;
  name: string;
}

export default function FacebookAdsPage() {
  const defaults = getDefaultDates();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);
  const [datePreset, setDatePreset] = useState("Last 7 Days");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [drillLevel, setDrillLevel] = useState<DrillLevel>("campaigns");
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [currentDrillId, setCurrentDrillId] = useState<string>("");
  const [drilledCampaignId, setDrilledCampaignId] = useState<string>("");

  const { data: accounts, isLoading: accountsLoading, error: accountsError } = useQuery<AdAccount[]>({
    queryKey: ["/api/facebook/ad-accounts"],
  });

  const selectedAccountObj = accounts?.find(a => a.id === selectedAccount);
  const accountTz = selectedAccountObj?.timezone_name;

  const applyPreset = (preset: typeof FB_DATE_PRESETS[number]) => {
    const { start, end } = preset.getRange(accountTz);
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

  const { data: campaigns, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<NormalizedInsight[]>({
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
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentDrillId(bc.id);
      setDrillLevel(bc.level);
    }
  };

  const goBack = () => {
    if (drillLevel === "ads") {
      setCurrentDrillId(drilledCampaignId);
      setDrillLevel("adsets");
      setBreadcrumbs(prev => prev.slice(0, -1));
    } else if (drillLevel === "adsets") {
      setDrillLevel("campaigns");
      setCurrentDrillId("");
      setDrilledCampaignId("");
      setBreadcrumbs([]);
    }
  };

  const isTableLoading = drillLevel === "campaigns" ? campaignsLoading : drillLevel === "adsets" ? adsetsLoading : adsLoading;

  return (
    <div className="p-3 space-y-3" data-testid="page-facebook-ads">
      <div className="flex items-center gap-2 flex-wrap">
        <SiFacebook className="w-5 h-5 text-[#1877F2]" />
        <h1 className="text-base font-bold">Facebook Ads</h1>
        <Badge variant="outline" className="text-[9px]">Meta Marketing API v24.0</Badge>
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
                <Select value={selectedAccount} onValueChange={(v) => { setSelectedAccount(v); setDrillLevel("campaigns"); setBreadcrumbs([]); setCurrentDrillId(""); setDrilledCampaignId(""); const acct = accounts?.find(a => a.id === v); if (acct?.timezone_name) { const d = getDefaultDates(acct.timezone_name); setStartDate(d.startDate); setEndDate(d.endDate); } }}>
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
                      <div className="border-t my-1" />
                      <button
                        data-testid="btn-preset-custom"
                        className={`w-full text-left text-[11px] px-3 py-1.5 rounded-md transition-colors ${
                          datePreset === "Custom"
                            ? "bg-primary text-primary-foreground"
                            : "hover-elevate"
                        }`}
                        onClick={() => setDatePreset("Custom")}
                      >
                        Custom
                      </button>
                    </div>
                    <div className="p-3">
                      <div className="flex gap-2 mb-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">Start</label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                              setStartDate(e.target.value);
                              setDatePreset("Custom");
                            }}
                            className="h-9 rounded-md border px-2 text-[11px] bg-background w-[130px]"
                            data-testid="input-start-date"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-medium text-muted-foreground uppercase">End</label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                              setEndDate(e.target.value);
                              setDatePreset("Custom");
                            }}
                            className="h-9 rounded-md border px-2 text-[11px] bg-background w-[130px]"
                            data-testid="input-end-date"
                          />
                        </div>
                      </div>
                      <Calendar
                        mode="range"
                        selected={{
                          from: new Date(startDate + "T00:00:00"),
                          to: new Date(endDate + "T00:00:00"),
                        }}
                        onSelect={(range) => {
                          if (range?.from) {
                            setStartDate(toTzDateStr(range.from, accountTz));
                            if (range.to) {
                              setEndDate(toTzDateStr(range.to, accountTz));
                            } else {
                              setEndDate(toTzDateStr(range.from, accountTz));
                            }
                            setDatePreset("Custom");
                          }
                        }}
                        numberOfMonths={2}
                        className="rounded-md"
                        data-testid="calendar-range"
                      />
                      <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDatePickerOpen(false)}
                          data-testid="button-date-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setDatePickerOpen(false)}
                          data-testid="button-date-apply"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {selectedAccount && (
              <Button variant="outline" size="sm" onClick={() => refetchCampaigns()} className="text-[10px] gap-1" data-testid="btn-refresh-fb">
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedAccount && (
        <>
          {summaryLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <StatCard label="Total Spend" value={fmt$(summary.spend)} icon={DollarSign} />
              <StatCard label="Impressions" value={fmtN(summary.impressions)} icon={Eye} />
              <StatCard label="Reach" value={fmtN(summary.reach)} icon={Users} />
              <StatCard label="Clicks" value={fmtN(summary.clicks)} icon={MousePointerClick} sub={`CTR: ${fmtPct(summary.ctr)}`} />
              <StatCard label="CPC" value={fmt$(summary.cpc)} icon={TrendingUp} sub={`CPM: ${fmt$(summary.cpm)}`} />
              <StatCard label="Leads" value={fmtN(summary.leads)} icon={TrendingUp} sub={summary.costPerLead > 0 ? `CPL: ${fmt$(summary.costPerLead)}` : undefined} />
            </div>
          ) : null}

          <Card>
            <CardHeader className="p-3 pb-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {drillLevel !== "campaigns" && (
                    <Button variant="ghost" size="icon" onClick={goBack} data-testid="btn-drill-back">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                  )}
                  <CardTitle className="text-xs font-semibold">
                    {drillLevel === "campaigns" ? "Campaigns" : drillLevel === "adsets" ? "Ad Sets" : "Ads"}
                  </CardTitle>
                </div>

                {breadcrumbs.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
                    <span
                      className="cursor-pointer hover:text-foreground"
                      onClick={() => navigateToBreadcrumb(0)}
                      data-testid="breadcrumb-root"
                    >
                      All Campaigns
                    </span>
                    {breadcrumbs.slice(1).map((bc, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />
                        <span
                          className={i < breadcrumbs.length - 2 ? "cursor-pointer hover:text-foreground" : "text-foreground font-medium"}
                          onClick={() => i < breadcrumbs.length - 2 && navigateToBreadcrumb(i + 1)}
                        >
                          {bc.name}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-2">
              {isTableLoading ? (
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
              ) : drillLevel === "campaigns" ? (
                <CampaignTable data={campaigns || []} onDrill={drillIntoCampaign} />
              ) : drillLevel === "adsets" ? (
                <AdsetTable data={adsets || []} onDrill={drillIntoAdset} />
              ) : (
                <AdTable data={ads || []} />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedAccount && !accountsLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <SiFacebook className="w-10 h-10 text-[#1877F2] mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Select an Ad Account</p>
            <p className="text-[11px] text-muted-foreground">Choose a Facebook ad account above to view campaign performance data from Meta's Marketing API.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
