import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  BarChart3, ChevronDown, ChevronRight, Search,
  CalendarIcon, ChevronLeft, ChevronsLeft, ChevronsRight,
  Filter, X, RefreshCw, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import type { DateRange } from "react-day-picker";

const REFRESH_INTERVALS: { label: string; value: number }[] = [
  { label: "Off", value: 0 },
  { label: "30s", value: 30000 },
  { label: "1m", value: 60000 },
  { label: "5m", value: 300000 },
];

interface DrilldownStepData {
  stepNumber: number;
  stepName: string;
  completions: number;
  conversionFromPrev: number;
  conversionFromInitial: number;
}

interface DrilldownRow {
  groupValue: string;
  uniqueViews: number;
  grossViews: number;
  pageLands: number;
  formCompletions: number;
  steps: DrilldownStepData[];
}

interface DrilldownResult {
  rows: DrilldownRow[];
  totals: DrilldownRow;
  groupBy: string;
}

interface EventLog {
  id: number;
  page: string;
  pageType: string;
  domain: string;
  stepNumber: number;
  stepName: string;
  selectedValue: string | null;
  sessionId: string;
  eventType: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  deviceType: string | null;
  referrer: string | null;
  timeOnStep: number | null;
  eventTimestamp: string;
  os: string | null;
  browser: string | null;
  placement: string | null;
  geoState: string | null;
  ipAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  eventId: string | null;
  externalId: string | null;
  utmTerm: string | null;
  utmId: string | null;
  mediaType: string | null;
  campaignName: string | null;
  campaignId: string | null;
  adName: string | null;
  adId: string | null;
  adsetName: string | null;
  adsetId: string | null;
  fbclid: string | null;
  fbc: string | null;
  fbp: string | null;
  quizAnswers: Record<string, string> | null;
}

interface EventLogResult {
  events: EventLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Filters {
  domain: string;
  deviceType: string;
  page: string;
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
}

interface FilterOptions {
  utmSources: string[];
  utmCampaigns: string[];
  utmMediums: string[];
}

const DRILL_DIMENSIONS = [
  { value: "domain", label: "Domain" },
  { value: "deviceType", label: "Device Type" },
  { value: "page", label: "Audience" },
  { value: "utmSource", label: "UTM Source" },
  { value: "utmCampaign", label: "UTM Campaign" },
  { value: "utmMedium", label: "UTM Medium" },
];

const ALL_FILTER = "__all__";

function buildQueryParams(dateRange: DateRange | undefined, filters: Filters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  if (filters.domain && filters.domain !== ALL_FILTER) params.set("domain", filters.domain);
  if (filters.deviceType && filters.deviceType !== ALL_FILTER) params.set("deviceType", filters.deviceType);
  if (filters.page && filters.page !== ALL_FILTER) params.set("page", filters.page);
  if (filters.utmSource && filters.utmSource !== ALL_FILTER) params.set("utmSource", filters.utmSource);
  if (filters.utmCampaign && filters.utmCampaign !== ALL_FILTER) params.set("utmCampaign", filters.utmCampaign);
  if (filters.utmMedium && filters.utmMedium !== ALL_FILTER) params.set("utmMedium", filters.utmMedium);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      params.set(k, v);
    }
  }
  return params.toString();
}

function buildLogsQuery(dateRange: DateRange | undefined, filters: Filters, logPage: number, search: string): string {
  const params = new URLSearchParams();
  params.set("page", logPage.toString());
  params.set("limit", "50");
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  if (filters.domain && filters.domain !== ALL_FILTER) params.set("domain", filters.domain);
  if (filters.deviceType && filters.deviceType !== ALL_FILTER) params.set("deviceType", filters.deviceType);
  if (filters.page && filters.page !== ALL_FILTER) params.set("audience", filters.page);
  if (filters.utmSource && filters.utmSource !== ALL_FILTER) params.set("utmSource", filters.utmSource);
  if (filters.utmCampaign && filters.utmCampaign !== ALL_FILTER) params.set("utmCampaign", filters.utmCampaign);
  if (filters.utmMedium && filters.utmMedium !== ALL_FILTER) params.set("utmMedium", filters.utmMedium);
  if (search.trim()) params.set("search", search.trim());
  return params.toString();
}

const emptyFilters: Filters = {
  domain: ALL_FILTER,
  deviceType: ALL_FILTER,
  page: ALL_FILTER,
  utmSource: ALL_FILTER,
  utmCampaign: ALL_FILTER,
  utmMedium: ALL_FILTER,
};

function FilterBar({
  filters,
  onChange,
  filterOptions,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  filterOptions: FilterOptions | undefined;
}) {
  const activeCount = Object.values(filters).filter(v => v && v !== ALL_FILTER).length;

  return (
    <div className="border-b border-border pb-2" data-testid="card-filters">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Filter className="w-3 h-3 text-muted-foreground" />
        <span className="text-[11px] font-semibold">Filters</span>
        {activeCount > 0 && (
          <>
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-active-filters">{activeCount} active</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(emptyFilters)}
              data-testid="button-clear-filters"
            >
              <X className="w-3 h-3 mr-1" />
              <span className="text-[10px]">Clear</span>
            </Button>
          </>
        )}
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        <div>
          <label className="text-[10px] text-muted-foreground block">Domain</label>
          <Select value={filters.domain} onValueChange={(v) => onChange({ ...filters, domain: v })}>
            <SelectTrigger className="h-7 text-[11px]" data-testid="filter-domain">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All Domains</SelectItem>
              <SelectItem value="blueskylife.net">blueskylife.net</SelectItem>
              <SelectItem value="blueskylife.io">blueskylife.io</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block">Device Type</label>
          <Select value={filters.deviceType} onValueChange={(v) => onChange({ ...filters, deviceType: v })}>
            <SelectTrigger className="h-7 text-[11px]" data-testid="filter-deviceType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All Devices</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="tablet">Tablet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block">Audience</label>
          <Select value={filters.page} onValueChange={(v) => onChange({ ...filters, page: v })}>
            <SelectTrigger className="h-7 text-[11px]" data-testid="filter-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All Audiences</SelectItem>
              <SelectItem value="seniors">Seniors</SelectItem>
              <SelectItem value="veterans">Veterans</SelectItem>
              <SelectItem value="first-responders">First Responders</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block">UTM Source</label>
          <Select value={filters.utmSource} onValueChange={(v) => onChange({ ...filters, utmSource: v })}>
            <SelectTrigger className="h-7 text-[11px]" data-testid="filter-utmSource">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All Sources</SelectItem>
              {filterOptions?.utmSources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block">UTM Campaign</label>
          <Select value={filters.utmCampaign} onValueChange={(v) => onChange({ ...filters, utmCampaign: v })}>
            <SelectTrigger className="h-7 text-[11px]" data-testid="filter-utmCampaign">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All Campaigns</SelectItem>
              {filterOptions?.utmCampaigns.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground block">UTM Medium</label>
          <Select value={filters.utmMedium} onValueChange={(v) => onChange({ ...filters, utmMedium: v })}>
            <SelectTrigger className="h-7 text-[11px]" data-testid="filter-utmMedium">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All Mediums</SelectItem>
              {filterOptions?.utmMediums.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function DrilldownTable({
  parentFilters,
  dateRange,
  globalFilters,
  groupBy,
  depth,
  usedDimensions,
}: {
  parentFilters: Record<string, string>;
  dateRange: DateRange | undefined;
  globalFilters: Filters;
  groupBy: string;
  depth: number;
  usedDimensions: string[];
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, string>>({});

  const queryStr = buildQueryParams(dateRange, globalFilters, { groupBy, ...parentFilters });

  const { data, isLoading } = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", queryStr],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${queryStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drilldown");
      return res.json();
    },
  });

  const availableNextDimensions = DRILL_DIMENSIONS.filter(d => !usedDimensions.includes(d.value));

  const toggleRowDrill = (groupValue: string, dimension: string) => {
    setExpandedRows(prev => {
      if (prev[groupValue]) {
        const next = { ...prev };
        delete next[groupValue];
        return next;
      }
      return { ...prev, [groupValue]: dimension };
    });
  };

  const setRowDimension = (groupValue: string, dimension: string) => {
    setExpandedRows(prev => ({ ...prev, [groupValue]: dimension }));
  };

  if (isLoading) {
    return (
      <div className="space-y-1 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return <p className="text-[10px] text-muted-foreground text-center py-2">No data available.</p>;
  }

  const dimLabel = DRILL_DIMENSIONS.find(d => d.value === groupBy)?.label || groupBy;

  const totalLands = data.totals.pageLands || data.totals.uniqueViews;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="h-6">
            {depth < 3 && availableNextDimensions.length > 0 && <TableHead className="w-4 px-0.5 py-0" />}
            <TableHead className="text-[10px] min-w-[70px] px-1 py-0">{dimLabel}</TableHead>
            <TableHead className="text-[10px] text-right px-2 py-0">Lands</TableHead>
            <TableHead className="text-[10px] text-right px-2 py-0">Land CVR</TableHead>
            <TableHead className="text-[10px] text-right px-2 py-0">Form Complete</TableHead>
            <TableHead className="text-[10px] text-right px-2 py-0">Form CVR</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row) => {
            const isExpanded = !!expandedRows[row.groupValue];
            const canDrill = depth < 3 && availableNextDimensions.length > 0;
            const selectedSubDim = expandedRows[row.groupValue] || "";
            const rowLands = row.pageLands || row.uniqueViews;
            const landCvr = totalLands > 0 ? (rowLands / totalLands) * 100 : 0;
            const formCvr = rowLands > 0 ? (row.formCompletions / rowLands) * 100 : 0;

            return (
              <DrilldownRowComponent
                key={row.groupValue}
                row={row}
                canDrill={canDrill}
                isExpanded={isExpanded}
                selectedSubDim={selectedSubDim}
                availableNextDimensions={availableNextDimensions}
                parentFilters={parentFilters}
                dateRange={dateRange}
                globalFilters={globalFilters}
                groupBy={groupBy}
                depth={depth}
                usedDimensions={usedDimensions}
                onToggle={() => toggleRowDrill(row.groupValue, availableNextDimensions[0]?.value || "")}
                onChangeDim={(dim) => setRowDimension(row.groupValue, dim)}
                dimLabel={dimLabel}
                pageLands={rowLands}
                landCvr={landCvr}
                formCvr={formCvr}
              />
            );
          })}
          {(() => {
            const totCvr = totalLands > 0 ? (data.totals.formCompletions / totalLands) * 100 : 0;
            const canDrill = depth < 3 && availableNextDimensions.length > 0;
            return (
              <TableRow className="bg-muted/50 font-semibold border-t h-6" data-testid={`row-totals-${groupBy}-depth${depth}`}>
                {canDrill && <TableCell className="px-0.5 py-0" />}
                <TableCell className="text-[10px] font-bold px-1 py-0">Totals</TableCell>
                <TableCell className="text-right font-mono text-[10px] px-2 py-0 font-bold">{totalLands.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-[10px] px-2 py-0 font-bold">100.0%</TableCell>
                <TableCell className="text-right font-mono text-[10px] px-2 py-0 font-bold">{data.totals.formCompletions.toLocaleString()}</TableCell>
                <TableCell className={`text-right font-mono text-[10px] px-2 py-0 font-bold ${totCvr > 0 ? "" : "text-muted-foreground"}`}>{totCvr.toFixed(1)}%</TableCell>
              </TableRow>
            );
          })()}
        </TableBody>
      </Table>
    </div>
  );
}

function DrilldownRowComponent({
  row,
  canDrill,
  isExpanded,
  selectedSubDim,
  availableNextDimensions,
  parentFilters,
  dateRange,
  globalFilters,
  groupBy,
  depth,
  usedDimensions,
  onToggle,
  onChangeDim,
  dimLabel,
  pageLands,
  landCvr,
  formCvr,
}: {
  row: DrilldownRow;
  canDrill: boolean;
  isExpanded: boolean;
  selectedSubDim: string;
  availableNextDimensions: typeof DRILL_DIMENSIONS;
  parentFilters: Record<string, string>;
  dateRange: DateRange | undefined;
  globalFilters: Filters;
  groupBy: string;
  depth: number;
  usedDimensions: string[];
  onToggle: () => void;
  onChangeDim: (dim: string) => void;
  dimLabel: string;
  pageLands: number;
  landCvr: number;
  formCvr: number;
}) {
  const colSpan = 6 + (canDrill ? 1 : 0);

  return (
    <>
      <TableRow
        className={`h-6 ${canDrill ? "cursor-pointer hover-elevate" : ""}`}
        onClick={canDrill ? onToggle : undefined}
        data-testid={`row-drill-${groupBy}-${row.groupValue}`}
      >
        {canDrill && (
          <TableCell className="w-4 px-0.5 py-0">
            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </TableCell>
        )}
        <TableCell className="text-[10px] font-medium px-1 py-0">{row.groupValue}</TableCell>
        <TableCell className="text-right font-mono text-[10px] px-2 py-0">{pageLands.toLocaleString()}</TableCell>
        <TableCell className="text-right font-mono text-[10px] px-2 py-0">{landCvr.toFixed(1)}%</TableCell>
        <TableCell className="text-right font-mono text-[10px] px-2 py-0">{row.formCompletions.toLocaleString()}</TableCell>
        <TableCell className={`text-right font-mono text-[10px] px-2 py-0 ${formCvr > 0 ? "" : "text-muted-foreground"}`}>{formCvr.toFixed(1)}%</TableCell>
      </TableRow>
      {isExpanded && canDrill && (
        <TableRow data-testid={`row-drilldown-${groupBy}-${row.groupValue}`}>
          <TableCell colSpan={colSpan} className="p-0">
            <div className="border-y bg-muted/20 px-2 py-1 space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] py-0">{dimLabel}: {row.groupValue}</Badge>
                <span className="text-[10px] text-muted-foreground">drill down by</span>
                <Select value={selectedSubDim} onValueChange={onChangeDim}>
                  <SelectTrigger className="w-[130px] h-6 text-[10px]" data-testid={`select-subdim-${groupBy}-${row.groupValue}`}>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableNextDimensions.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedSubDim && (
                <div className="border rounded-md bg-background">
                  <DrilldownTable
                    parentFilters={{ ...parentFilters, [groupBy]: row.groupValue }}
                    dateRange={dateRange}
                    globalFilters={globalFilters}
                    groupBy={selectedSubDim}
                    depth={depth + 1}
                    usedDimensions={[...usedDimensions, selectedSubDim]}
                  />
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function FunnelReport({
  dateRange,
  filters,
}: {
  dateRange: DateRange | undefined;
  filters: Filters;
}) {
  const [drillDimension, setDrillDimension] = useState<string>("domain");

  const summaryQuery = buildQueryParams(dateRange, filters, { groupBy: "domain" });
  const { data: summaryData, isLoading: summaryLoading } = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", "summary", summaryQuery],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${summaryQuery}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  if (summaryLoading) {
    return (
      <div data-testid="card-funnel-report">
        <Skeleton className="h-4 w-48 mb-2" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!summaryData) return null;

  const totals = summaryData.totals;
  const pageLands = totals.pageLands || totals.uniqueViews;
  const lastStep = totals.steps[totals.steps.length - 1];
  const finalCount = totals.formCompletions > 0 ? totals.formCompletions : (lastStep?.completions || 0);
  const overallConversion = pageLands > 0 ? (finalCount / pageLands) * 100 : 0;

  return (
    <div data-testid="card-funnel-report">
      <h3 className="text-[11px] font-semibold mb-1" data-testid="text-funnel-title">Funnel Summary</h3>
      <div className="overflow-x-auto border rounded-md mb-2">
        <Table>
          <TableHeader>
            <TableRow className="h-6">
              <TableHead className="text-[10px] text-right px-2 py-0">Lands</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Total Events</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Form Complete</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Form CVR</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Steps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="h-6">
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-page-lands">{pageLands.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-total-events">{totals.grossViews.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-overall-conversion">{finalCount.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0">{overallConversion.toFixed(1)}%</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-total-steps">{totals.steps.length}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="border-t pt-2 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold">Drill down by</span>
          <Select value={drillDimension} onValueChange={setDrillDimension}>
            <SelectTrigger className="w-[140px] h-6 text-[10px]" data-testid="select-drill-dimension">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRILL_DIMENSIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="border rounded-md">
          <DrilldownTable
            parentFilters={{}}
            dateRange={dateRange}
            globalFilters={filters}
            groupBy={drillDimension}
            depth={1}
            usedDimensions={[drillDimension]}
          />
        </div>
      </div>
    </div>
  );
}

function EventLogsSection({
  dateRange,
  filters,
}: {
  dateRange: DateRange | undefined;
  filters: Filters;
}) {
  const [expanded, setExpanded] = useState(false);
  const [logPage, setLogPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setLogPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<Set<number>>(new Set());
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const logsQueryStr = buildLogsQuery(dateRange, filters, logPage, debouncedSearch);
  const logsQuery = useQuery<EventLogResult>({
    queryKey: ["/api/analytics/logs", logsQueryStr],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/logs?${logsQueryStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    enabled: expanded,
  });

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const invalidateAnalytics = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/analytics");
      },
    });
  };

  const deleteEvent = async (id: number) => {
    setDeleting(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/analytics/events/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Event deleted" });
      invalidateAnalytics();
    } catch {
      toast({ title: "Failed to delete event", variant: "destructive" });
    } finally {
      setDeleting(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const deleteSession = async (sessionId: string) => {
    setDeletingSession(sessionId);
    try {
      const res = await fetch(`/api/analytics/events/session/${sessionId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      const data = await res.json();
      toast({ title: `Deleted ${data.count} events for this session` });
      invalidateAnalytics();
    } catch {
      toast({ title: "Failed to delete session events", variant: "destructive" });
    } finally {
      setDeletingSession(null);
    }
  };

  const deleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await fetch("/api/analytics/all-events", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "All events deleted" });
      setConfirmDeleteAll(false);
      invalidateAnalytics();
    } catch {
      toast({ title: "Failed to delete all events", variant: "destructive" });
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="border-t pt-2" data-testid="card-event-logs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-left"
          data-testid="button-toggle-logs"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <h3 className="text-[11px] font-semibold">Event Logs</h3>
          {logsQuery.data && (
            <Badge variant="secondary" className="text-[9px] py-0 ml-1">{logsQuery.data.total.toLocaleString()} records</Badge>
          )}
        </button>
        {expanded && logsQuery.data && logsQuery.data.total > 0 && (
          confirmDeleteAll ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-destructive font-medium">Delete all {logsQuery.data.total.toLocaleString()} events?</span>
              <Button variant="destructive" size="sm" onClick={deleteAll} disabled={deletingAll} data-testid="button-confirm-delete-all">
                {deletingAll ? "..." : "Yes"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(false)} data-testid="button-cancel-delete-all">
                No
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteAll(true)} data-testid="button-delete-all">
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="text-[10px]">Delete All</span>
            </Button>
          )
        )}
      </div>

      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              placeholder="Search by session ID, step, value, campaign..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-7 text-[11px]"
              data-testid="input-log-search"
            />
          </div>

          {logsQuery.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : logsQuery.data && logsQuery.data.events.length > 0 ? (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="h-6">
                      <TableHead className="w-5 px-0.5 py-0" />
                      <TableHead className="text-[10px] px-1 py-0">Timestamp</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Session ID</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Event</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Audience</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Domain</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Step</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Value</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Device</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">OS</TableHead>
                      <TableHead className="text-[10px] px-1 py-0">Browser</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsQuery.data.events.map((event) => (
                      <EventLogRow
                        key={event.id}
                        event={event}
                        isExpanded={expandedRows.has(event.id)}
                        onToggle={() => toggleRow(event.id)}
                        onDeleteEvent={() => deleteEvent(event.id)}
                        onDeleteSession={() => deleteSession(event.sessionId)}
                        isDeleting={deleting.has(event.id)}
                        isDeletingSession={deletingSession === event.sessionId}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] text-muted-foreground">
                  {((logsQuery.data.page - 1) * logsQuery.data.limit) + 1}-{Math.min(logsQuery.data.page * logsQuery.data.limit, logsQuery.data.total)} of {logsQuery.data.total.toLocaleString()}
                </p>
                <div className="flex items-center gap-0.5">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(1)} disabled={logsQuery.data.page <= 1} data-testid="button-log-first">
                    <ChevronsLeft className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logsQuery.data.page <= 1} data-testid="button-log-prev">
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <span className="px-2 text-[10px] font-mono">
                    {logsQuery.data.page} / {logsQuery.data.totalPages}
                  </span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(p => Math.min(logsQuery.data!.totalPages, p + 1))} disabled={logsQuery.data.page >= logsQuery.data.totalPages} data-testid="button-log-next">
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(logsQuery.data!.totalPages)} disabled={logsQuery.data.page >= logsQuery.data.totalPages} data-testid="button-log-last">
                    <ChevronsRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-3 text-center text-muted-foreground text-[11px]">
              {debouncedSearch ? "No records match your search." : "No event logs found for the selected filters."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventLogRow({
  event,
  isExpanded,
  onToggle,
  onDeleteEvent,
  onDeleteSession,
  isDeleting,
  isDeletingSession,
}: {
  event: EventLog;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleteEvent: () => void;
  onDeleteSession: () => void;
  isDeleting: boolean;
  isDeletingSession: boolean;
}) {
  const ts = new Date(event.eventTimestamp);
  const formattedDate = format(ts, "MMM d h:mm:ss a");

  return (
    <>
      <TableRow
        className="cursor-pointer hover-elevate h-6"
        onClick={onToggle}
        data-testid={`row-log-${event.id}`}
      >
        <TableCell className="w-5 px-0.5 py-0">
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </TableCell>
        <TableCell className="text-[10px] font-mono whitespace-nowrap px-1 py-0">{formattedDate}</TableCell>
        <TableCell className="text-[10px] font-mono max-w-[80px] truncate px-1 py-0" title={event.sessionId}>
          {event.sessionId.substring(0, 8)}...
        </TableCell>
        <TableCell className="px-1 py-0">
          <Badge variant="secondary" className="text-[9px] py-0">{event.eventType || "step_complete"}</Badge>
        </TableCell>
        <TableCell className="text-[10px] px-1 py-0">{event.page}</TableCell>
        <TableCell className="text-[10px] px-1 py-0">{event.domain}</TableCell>
        <TableCell className="text-[10px] font-mono px-1 py-0">{event.stepNumber}. {event.stepName}</TableCell>
        <TableCell className="text-[10px] max-w-[80px] truncate px-1 py-0" title={event.selectedValue || ""}>
          {event.selectedValue || "\u2014"}
        </TableCell>
        <TableCell className="text-[10px] px-1 py-0">{event.deviceType || "\u2014"}</TableCell>
        <TableCell className="text-[10px] px-1 py-0">{event.os || "\u2014"}</TableCell>
        <TableCell className="text-[10px] px-1 py-0">{event.browser || "\u2014"}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow data-testid={`row-log-detail-${event.id}`}>
          <TableCell colSpan={11} className="p-0">
            <div className="bg-muted/50 px-3 py-2 space-y-1.5">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-0.5 text-[10px]">
                <DetailField label="ID" value={String(event.id)} />
                <DetailField label="Session ID" value={event.sessionId} />
                <DetailField label="Event Type" value={event.eventType || "step_complete"} />
                <DetailField label="Audience" value={event.page} />
                <DetailField label="Funnel Type" value={event.pageType} />
                <DetailField label="Domain" value={event.domain} />
                <DetailField label="Step" value={`${event.stepNumber}. ${event.stepName}`} />
                <DetailField label="Selected Value" value={event.selectedValue || "\u2014"} />
                <DetailField label="Time on Step" value={event.timeOnStep !== null ? `${event.timeOnStep}s` : "\u2014"} />
                <DetailField label="Device" value={event.deviceType || "\u2014"} />
                <DetailField label="OS" value={event.os || "\u2014"} />
                <DetailField label="Browser" value={event.browser || "\u2014"} />
                <DetailField label="Geo State" value={event.geoState || "\u2014"} />
                <DetailField label="IP Address" value={event.ipAddress || "\u2014"} />
                <DetailField label="Placement" value={event.placement || "\u2014"} />
                <DetailField label="UTM Source" value={event.utmSource || "\u2014"} />
                <DetailField label="UTM Campaign" value={event.utmCampaign || "\u2014"} />
                <DetailField label="UTM Medium" value={event.utmMedium || "\u2014"} />
                <DetailField label="UTM Content" value={event.utmContent || "\u2014"} />
                <DetailField label="UTM Term" value={event.utmTerm || "\u2014"} />
                <DetailField label="UTM ID" value={event.utmId || "\u2014"} />
                <DetailField label="Media Type" value={event.mediaType || "\u2014"} />
                <DetailField label="Campaign Name" value={event.campaignName || "\u2014"} />
                <DetailField label="Campaign ID" value={event.campaignId || "\u2014"} />
                <DetailField label="Ad Name" value={event.adName || "\u2014"} />
                <DetailField label="Ad ID" value={event.adId || "\u2014"} />
                <DetailField label="Adset Name" value={event.adsetName || "\u2014"} />
                <DetailField label="Adset ID" value={event.adsetId || "\u2014"} />
                <DetailField label="FBCLID" value={event.fbclid || "\u2014"} />
                <DetailField label="FBC" value={event.fbc || "\u2014"} />
                <DetailField label="FBP" value={event.fbp || "\u2014"} />
                <DetailField label="Event ID" value={event.eventId || "\u2014"} />
                <DetailField label="External ID" value={event.externalId || "\u2014"} />
                <DetailField label="Referrer" value={event.referrer || "\u2014"} />
                <DetailField label="Timestamp" value={formattedDate} />
                {event.quizAnswers && Object.keys(event.quizAnswers).length > 0 && (
                  <>
                    {Object.entries(event.quizAnswers).map(([key, val]) => (
                      <DetailField key={key} label={`Quiz: ${key.charAt(0).toUpperCase() + key.slice(1)}`} value={val} />
                    ))}
                  </>
                )}
                {event.eventType === "form_complete" && (
                  <>
                    <DetailField label="First Name" value={event.firstName || "\u2014"} />
                    <DetailField label="Last Name" value={event.lastName || "\u2014"} />
                    <DetailField label="Email" value={event.email || "\u2014"} />
                    <DetailField label="Phone" value={event.phone || "\u2014"} />
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDeleteEvent(); }}
                  disabled={isDeleting}
                  data-testid={`button-delete-event-${event.id}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">{isDeleting ? "..." : "Delete event"}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(); }}
                  disabled={isDeletingSession}
                  data-testid={`button-delete-session-${event.id}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">{isDeletingSession ? "..." : "Delete session"}</span>
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <span className="text-muted-foreground text-[9px]">{label}</span>
      <p className="font-mono break-all text-[10px]">{value}</p>
    </div>
  );
}

function LastUpdatedIndicator({ lastUpdated, isRefreshing }: { lastUpdated: Date | null; isRefreshing: boolean }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  if (!lastUpdated) return null;

  return (
    <span className="text-[10px] text-muted-foreground" data-testid="text-last-updated">
      {isRefreshing ? (
        "Refreshing..."
      ) : (
        <>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</>
      )}
    </span>
  );
}

export default function ReportsPage() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [refreshInterval, setRefreshInterval] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["/api/analytics/filter-options"],
    queryFn: async () => {
      const res = await fetch("/api/analytics/filter-options", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch filter options");
      return res.json();
    },
  });

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/analytics");
      },
    });
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [queryClient]);

  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  useEffect(() => {
    if (refreshInterval === 0) return;
    const timer = setInterval(refreshAll, refreshInterval);
    return () => clearInterval(timer);
  }, [refreshInterval, refreshAll]);

  return (
    <div className="px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          <h1 className="text-sm font-bold" data-testid="text-reports-title">Funnel Reports</h1>
          <span className="text-[10px] text-muted-foreground">drill down up to 3 levels deep</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <LastUpdatedIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="text-[10px]">Refresh</span>
          </Button>
          <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[80px] h-7 text-[10px]" data-testid="select-auto-refresh">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFRESH_INTERVALS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label === "Off" ? "Auto: Off" : `Auto: ${opt.label}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-date-range">
              <CalendarIcon className="w-3 h-3 mr-1.5" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span className="text-[10px]">
                    {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-[10px]">{format(dateRange.from, "MMM d, yyyy")}</span>
                )
              ) : (
                <span className="text-[10px]">All Time</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              data-testid="calendar-date-range"
            />
            {dateRange && (
              <div className="p-2 border-t flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)} data-testid="button-clear-dates">
                  Clear
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <FilterBar filters={filters} onChange={setFilters} filterOptions={filterOptions} />

      <FunnelReport dateRange={dateRange} filters={filters} />

      <EventLogsSection dateRange={dateRange} filters={filters} />
    </div>
  );
}
