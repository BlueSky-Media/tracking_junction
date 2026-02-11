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
  Filter, X, RefreshCw,
} from "lucide-react";
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
  params.set("limit", "25");
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
    <Card className="p-4" data-testid="card-filters">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Filters</span>
        {activeCount > 0 && (
          <>
            <Badge variant="secondary" className="text-xs" data-testid="badge-active-filters">{activeCount} active</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(emptyFilters)}
              data-testid="button-clear-filters"
            >
              <X className="w-3 h-3 mr-1" />
              Clear all
            </Button>
          </>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Domain</label>
          <Select value={filters.domain} onValueChange={(v) => onChange({ ...filters, domain: v })}>
            <SelectTrigger data-testid="filter-domain">
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
          <label className="text-xs text-muted-foreground mb-1 block">Device Type</label>
          <Select value={filters.deviceType} onValueChange={(v) => onChange({ ...filters, deviceType: v })}>
            <SelectTrigger data-testid="filter-deviceType">
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
          <label className="text-xs text-muted-foreground mb-1 block">Audience</label>
          <Select value={filters.page} onValueChange={(v) => onChange({ ...filters, page: v })}>
            <SelectTrigger data-testid="filter-audience">
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
          <label className="text-xs text-muted-foreground mb-1 block">UTM Source</label>
          <Select value={filters.utmSource} onValueChange={(v) => onChange({ ...filters, utmSource: v })}>
            <SelectTrigger data-testid="filter-utmSource">
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
          <label className="text-xs text-muted-foreground mb-1 block">UTM Campaign</label>
          <Select value={filters.utmCampaign} onValueChange={(v) => onChange({ ...filters, utmCampaign: v })}>
            <SelectTrigger data-testid="filter-utmCampaign">
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
          <label className="text-xs text-muted-foreground mb-1 block">UTM Medium</label>
          <Select value={filters.utmMedium} onValueChange={(v) => onChange({ ...filters, utmMedium: v })}>
            <SelectTrigger data-testid="filter-utmMedium">
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
    </Card>
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
      <div className="space-y-2 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No data available.</p>;
  }

  const dimLabel = DRILL_DIMENSIONS.find(d => d.value === groupBy)?.label || groupBy;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {depth < 3 && availableNextDimensions.length > 0 && <TableHead className="w-8" />}
            <TableHead className="min-w-[120px]">{dimLabel}</TableHead>
            <TableHead className="text-right min-w-[80px]">Sessions</TableHead>
            <TableHead className="text-right min-w-[80px]">Events</TableHead>
            {data.totals.steps.map((s) => (
              <TableHead key={`h-${s.stepNumber}-${s.stepName}`} className="text-center min-w-[90px]">
                <div className="flex flex-col items-center">
                  <span className="text-xs font-semibold">{s.stepName}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row) => {
            const isExpanded = !!expandedRows[row.groupValue];
            const canDrill = depth < 3 && availableNextDimensions.length > 0;
            const selectedSubDim = expandedRows[row.groupValue] || "";

            return (
              <DrilldownRowComponent
                key={row.groupValue}
                row={row}
                canDrill={canDrill}
                isExpanded={isExpanded}
                selectedSubDim={selectedSubDim}
                availableNextDimensions={availableNextDimensions}
                allSteps={data.totals.steps}
                parentFilters={parentFilters}
                dateRange={dateRange}
                globalFilters={globalFilters}
                groupBy={groupBy}
                depth={depth}
                usedDimensions={usedDimensions}
                onToggle={() => toggleRowDrill(row.groupValue, availableNextDimensions[0]?.value || "")}
                onChangeDim={(dim) => setRowDimension(row.groupValue, dim)}
                dimLabel={dimLabel}
              />
            );
          })}
          <TableRow className="bg-muted/50 font-semibold border-t-2" data-testid={`row-totals-${groupBy}-depth${depth}`}>
            {canDrillCell(depth, availableNextDimensions)}
            <TableCell className="font-bold">Totals</TableCell>
            <TableCell className="text-right font-mono">{data.totals.uniqueViews.toLocaleString()}</TableCell>
            <TableCell className="text-right font-mono text-muted-foreground">{data.totals.grossViews.toLocaleString()}</TableCell>
            {data.totals.steps.map((step) => (
              <TableCell key={`tot-${step.stepNumber}-${step.stepName}`} className="text-center">
                <div className="space-y-0.5">
                  <p className="font-mono text-xs font-semibold">{step.completions.toLocaleString()}</p>
                  <p className="font-mono text-xs text-muted-foreground">{step.conversionFromInitial.toFixed(1)}%</p>
                </div>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

function canDrillCell(depth: number, availableNextDimensions: typeof DRILL_DIMENSIONS) {
  if (depth < 3 && availableNextDimensions.length > 0) {
    return <TableCell />;
  }
  return null;
}

function DrilldownRowComponent({
  row,
  canDrill,
  isExpanded,
  selectedSubDim,
  availableNextDimensions,
  allSteps,
  parentFilters,
  dateRange,
  globalFilters,
  groupBy,
  depth,
  usedDimensions,
  onToggle,
  onChangeDim,
  dimLabel,
}: {
  row: DrilldownRow;
  canDrill: boolean;
  isExpanded: boolean;
  selectedSubDim: string;
  availableNextDimensions: typeof DRILL_DIMENSIONS;
  allSteps: DrilldownStepData[];
  parentFilters: Record<string, string>;
  dateRange: DateRange | undefined;
  globalFilters: Filters;
  groupBy: string;
  depth: number;
  usedDimensions: string[];
  onToggle: () => void;
  onChangeDim: (dim: string) => void;
  dimLabel: string;
}) {
  const colSpan = 3 + allSteps.length + (canDrill ? 1 : 0);

  return (
    <>
      <TableRow
        className={canDrill ? "cursor-pointer hover-elevate" : ""}
        onClick={canDrill ? onToggle : undefined}
        data-testid={`row-drill-${groupBy}-${row.groupValue}`}
      >
        {canDrill && (
          <TableCell className="w-8">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </TableCell>
        )}
        <TableCell className="font-medium">{row.groupValue}</TableCell>
        <TableCell className="text-right font-mono">{row.uniqueViews.toLocaleString()}</TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">{row.grossViews.toLocaleString()}</TableCell>
        {row.steps.map((step) => {
          const isLow = step.conversionFromPrev < 50 && step.conversionFromPrev > 0;
          return (
            <TableCell key={`${row.groupValue}-${step.stepNumber}-${step.stepName}`} className="text-center">
              <div className="space-y-0.5">
                <p className="font-mono text-xs">{step.completions.toLocaleString()}</p>
                <p className={`font-mono text-xs ${isLow ? "text-destructive" : "text-muted-foreground"}`}>
                  {step.conversionFromInitial.toFixed(1)}%
                </p>
              </div>
            </TableCell>
          );
        })}
      </TableRow>
      {isExpanded && canDrill && (
        <TableRow data-testid={`row-drilldown-${groupBy}-${row.groupValue}`}>
          <TableCell colSpan={colSpan} className="p-0">
            <div className="border-y bg-muted/20 px-4 py-3 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs">{dimLabel}: {row.groupValue}</Badge>
                <span className="text-sm text-muted-foreground">drill down by</span>
                <Select value={selectedSubDim} onValueChange={onChangeDim}>
                  <SelectTrigger className="w-[180px]" data-testid={`select-subdim-${groupBy}-${row.groupValue}`}>
                    <SelectValue placeholder="Select dimension..." />
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
      <Card className="p-5" data-testid="card-funnel-report">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!summaryData) return null;

  const totals = summaryData.totals;
  const lastStep = totals.steps[totals.steps.length - 1];
  const overallConversion = lastStep ? lastStep.conversionFromInitial : 0;

  return (
    <Card className="p-5" data-testid="card-funnel-report">
      <h3 className="font-semibold mb-4" data-testid="text-funnel-title">Funnel Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Total Sessions</p>
          <p className="text-2xl font-bold font-mono" data-testid="text-total-sessions">{totals.uniqueViews.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Total Events</p>
          <p className="text-2xl font-bold font-mono" data-testid="text-total-events">{totals.grossViews.toLocaleString()}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Overall Conversion</p>
          <p className="text-2xl font-bold font-mono" data-testid="text-overall-conversion">{overallConversion.toFixed(1)}%</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Funnel Steps</p>
          <p className="text-2xl font-bold font-mono" data-testid="text-total-steps">{totals.steps.length}</p>
        </div>
      </div>

      <div className="overflow-x-auto mb-5">
        <Table>
          <TableHeader>
            <TableRow>
              {totals.steps.map((s) => (
                <TableHead key={`sum-${s.stepNumber}-${s.stepName}`} className="text-center min-w-[100px]">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold">Step {s.stepNumber}</span>
                    <span className="text-xs text-muted-foreground font-normal">{s.stepName}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              {totals.steps.map((s) => (
                <TableCell key={`sumv-${s.stepNumber}-${s.stepName}`} className="text-center">
                  <div className="space-y-0.5">
                    <p className="font-mono text-sm font-semibold">{s.completions.toLocaleString()}</p>
                    <p className={`font-mono text-xs ${s.conversionFromPrev < 50 && s.conversionFromPrev > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {s.conversionFromPrev.toFixed(1)}% step
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {s.conversionFromInitial.toFixed(1)}% overall
                    </p>
                  </div>
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold">Drill down by</span>
          <Select value={drillDimension} onValueChange={setDrillDimension}>
            <SelectTrigger className="w-[180px]" data-testid="select-drill-dimension">
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
    </Card>
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

  return (
    <Card className="p-5" data-testid="card-event-logs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
        data-testid="button-toggle-logs"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <h3 className="font-semibold">Event Logs</h3>
        {logsQuery.data && (
          <Badge variant="secondary" className="ml-2 text-xs">{logsQuery.data.total.toLocaleString()} records</Badge>
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by session ID, step, value, campaign..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-log-search"
              />
            </div>
          </div>

          {logsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : logsQuery.data && logsQuery.data.events.length > 0 ? (
            <>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="text-xs">Timestamp</TableHead>
                      <TableHead className="text-xs">Session ID</TableHead>
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Audience</TableHead>
                      <TableHead className="text-xs">Domain</TableHead>
                      <TableHead className="text-xs">Step</TableHead>
                      <TableHead className="text-xs">Value</TableHead>
                      <TableHead className="text-xs">Device</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsQuery.data.events.map((event) => (
                      <EventLogRow
                        key={event.id}
                        event={event}
                        isExpanded={expandedRows.has(event.id)}
                        onToggle={() => toggleRow(event.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  Showing {((logsQuery.data.page - 1) * logsQuery.data.limit) + 1}-{Math.min(logsQuery.data.page * logsQuery.data.limit, logsQuery.data.total)} of {logsQuery.data.total.toLocaleString()} records
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => setLogPage(1)} disabled={logsQuery.data.page <= 1} data-testid="button-log-first">
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={logsQuery.data.page <= 1} data-testid="button-log-prev">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 text-sm font-mono">
                    {logsQuery.data.page} / {logsQuery.data.totalPages}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => setLogPage(p => Math.min(logsQuery.data!.totalPages, p + 1))} disabled={logsQuery.data.page >= logsQuery.data.totalPages} data-testid="button-log-next">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => setLogPage(logsQuery.data!.totalPages)} disabled={logsQuery.data.page >= logsQuery.data.totalPages} data-testid="button-log-last">
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {debouncedSearch ? "No records match your search." : "No event logs found for the selected filters."}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function EventLogRow({
  event,
  isExpanded,
  onToggle,
}: {
  event: EventLog;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ts = new Date(event.eventTimestamp);
  const formattedDate = format(ts, "MMM d, yyyy h:mm:ss a");

  return (
    <>
      <TableRow
        className="cursor-pointer hover-elevate"
        onClick={onToggle}
        data-testid={`row-log-${event.id}`}
      >
        <TableCell className="w-8">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </TableCell>
        <TableCell className="text-xs font-mono whitespace-nowrap">{formattedDate}</TableCell>
        <TableCell className="text-xs font-mono max-w-[120px] truncate" title={event.sessionId}>
          {event.sessionId.substring(0, 8)}...
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="text-xs">{event.eventType || "step_complete"}</Badge>
        </TableCell>
        <TableCell className="text-xs">{event.page}</TableCell>
        <TableCell className="text-xs">{event.domain}</TableCell>
        <TableCell className="text-xs font-mono">{event.stepNumber}. {event.stepName}</TableCell>
        <TableCell className="text-xs max-w-[120px] truncate" title={event.selectedValue || ""}>
          {event.selectedValue || "\u2014"}
        </TableCell>
        <TableCell className="text-xs">{event.deviceType || "\u2014"}</TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow data-testid={`row-log-detail-${event.id}`}>
          <TableCell colSpan={9}>
            <div className="bg-muted/50 rounded-md p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
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
              <DetailField label="UTM Source" value={event.utmSource || "\u2014"} />
              <DetailField label="UTM Campaign" value={event.utmCampaign || "\u2014"} />
              <DetailField label="UTM Medium" value={event.utmMedium || "\u2014"} />
              <DetailField label="UTM Content" value={event.utmContent || "\u2014"} />
              <DetailField label="Referrer" value={event.referrer || "\u2014"} />
              <DetailField label="Timestamp" value={formattedDate} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <p className="font-mono break-all">{value}</p>
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
    <span className="text-xs text-muted-foreground" data-testid="text-last-updated">
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
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
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
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
            <BarChart3 className="w-6 h-6" />
            Funnel Reports
          </h1>
          <p className="text-sm text-muted-foreground">One report, drill down up to 3 levels deep</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LastUpdatedIndicator lastUpdated={lastUpdated} isRefreshing={isRefreshing} />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isRefreshing}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Select value={String(refreshInterval)} onValueChange={(v) => setRefreshInterval(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="select-auto-refresh">
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

      <div className="flex items-center gap-3 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" data-testid="button-date-range">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span className="text-sm">
                    {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                  </span>
                ) : (
                  <span className="text-sm">{format(dateRange.from, "MMM d, yyyy")}</span>
                )
              ) : (
                <span className="text-sm">All Time</span>
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
