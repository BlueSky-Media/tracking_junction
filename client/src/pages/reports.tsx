import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  BarChart3, ChevronDown, ChevronRight, Search,
  CalendarIcon, ChevronLeft, ChevronsLeft, ChevronsRight,
  Filter, X, RefreshCw, Trash2,
  Play, Pause, Download, Ban, Phone, FileText, Clock,
  MinusCircle, Save,
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

interface SessionLogEntry {
  sessionId: string;
  events: EventLog[];
  maxStep: number;
  maxStepName: string;
  maxEventType: string;
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;
  page: string;
  pageType: string;
  domain: string;
  deviceType: string | null;
  os: string | null;
  browser: string | null;
}

interface SessionLogResult {
  sessions: SessionLogEntry[];
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const subDimLabel = availableNextDimensions.find(d => d.value === selectedSubDim)?.label;

  const handleDimSelect = (dim: string) => {
    setPopoverOpen(false);
    onChangeDim(dim);
  };

  return (
    <>
      <TableRow
        className="h-6"
        data-testid={`row-drill-${groupBy}-${row.groupValue}`}
      >
        {canDrill && (
          <TableCell className="w-4 px-0.5 py-0">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="flex items-center justify-center w-4 h-4 cursor-pointer hover:text-foreground text-muted-foreground"
                  data-testid={`btn-drill-${groupBy}-${row.groupValue}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isExpanded) {
                      onToggle();
                    } else {
                      setPopoverOpen(true);
                    }
                  }}
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-1" align="start" side="bottom">
                <div className="flex flex-col">
                  {availableNextDimensions.map((d) => (
                    <button
                      key={d.value}
                      className="text-left text-[10px] px-2 py-1 rounded-md hover-elevate cursor-pointer"
                      data-testid={`btn-subdim-${d.value}-${row.groupValue}`}
                      onClick={() => handleDimSelect(d.value)}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </TableCell>
        )}
        <TableCell className="text-[10px] font-medium px-1 py-0">
          {row.groupValue}
          {isExpanded && subDimLabel && (
            <span className="text-muted-foreground ml-1">- {subDimLabel}</span>
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-[10px] px-2 py-0">{pageLands.toLocaleString()}</TableCell>
        <TableCell className="text-right font-mono text-[10px] px-2 py-0">{landCvr.toFixed(1)}%</TableCell>
        <TableCell className="text-right font-mono text-[10px] px-2 py-0">{row.formCompletions.toLocaleString()}</TableCell>
        <TableCell className={`text-right font-mono text-[10px] px-2 py-0 ${formCvr > 0 ? "" : "text-muted-foreground"}`}>{formCvr.toFixed(1)}%</TableCell>
      </TableRow>
      {isExpanded && canDrill && selectedSubDim && (
        <TableRow data-testid={`row-drilldown-${groupBy}-${row.groupValue}`}>
          <TableCell colSpan={colSpan} className="p-0">
            <div className="border-y bg-muted/20 px-1 py-0.5">
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
  drillDimension,
  onDrillDimensionChange,
}: {
  dateRange: DateRange | undefined;
  filters: Filters;
  drillDimension: string;
  onDrillDimensionChange: (d: string) => void;
}) {

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
          <Select value={drillDimension} onValueChange={onDrillDimensionChange}>
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

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  checkbox: 28,
  expand: 24,
  lastActivity: 140,
  sessionId: 110,
  events: 50,
  furthestStep: 110,
  status: 80,
  audience: 80,
  domain: 120,
  device: 70,
  os: 70,
  browser: 70,
};

const STORAGE_KEY = "trackingjunction_view_state";

interface SavedViewState {
  filters: Filters;
  drillDimension: string;
  dateRange?: { from?: string; to?: string };
  refreshInterval: number;
  logsExpanded: boolean;
}

function loadSavedView(): Partial<SavedViewState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveViewState(state: SavedViewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const SESSION_COLUMNS = [
  { key: "checkbox", label: "", resizable: false },
  { key: "expand", label: "", resizable: false },
  { key: "lastActivity", label: "Last Activity", resizable: true },
  { key: "sessionId", label: "Session ID", resizable: true },
  { key: "events", label: "Events", resizable: true },
  { key: "furthestStep", label: "Furthest Step", resizable: true },
  { key: "status", label: "Status", resizable: true },
  { key: "audience", label: "Audience", resizable: true },
  { key: "domain", label: "Domain", resizable: true },
  { key: "device", label: "Device", resizable: true },
  { key: "os", label: "OS", resizable: true },
  { key: "browser", label: "Browser", resizable: true },
];

function ResizableHeader({
  colKey,
  label,
  width,
  resizable,
  onResize,
}: {
  colKey: string;
  label: string;
  width: number;
  resizable: boolean;
  onResize: (key: string, width: number) => void;
}) {
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX.current;
      const newWidth = Math.max(30, startWidth.current + diff);
      onResize(colKey, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colKey, width, onResize]);

  return (
    <th
      className="text-[10px] px-1 py-0 relative select-none font-medium text-muted-foreground"
      style={{ width: `${width}px`, minWidth: `${width}px` }}
    >
      {label}
      {resizable && (
        <span
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/30"
          onMouseDown={onMouseDown}
          data-testid={`resize-${colKey}`}
        />
      )}
    </th>
  );
}

function EventLogsSection({
  dateRange,
  filters,
  filterOptions,
  onFiltersChange,
  expanded,
  onToggleExpanded,
}: {
  dateRange: DateRange | undefined;
  filters: Filters;
  filterOptions: FilterOptions | undefined;
  onFiltersChange: (f: Filters) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [logPage, setLogPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({ ...DEFAULT_COL_WIDTHS });
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setLogPage(1);
      setSelectedSessions(new Set());
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedSessions(new Set());
  }, [logPage]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const logsQueryStr = buildLogsQuery(dateRange, filters, logPage, debouncedSearch);
  const sessionsQuery = useQuery<SessionLogResult>({
    queryKey: ["/api/analytics/sessions", logsQueryStr],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/sessions?${logsQueryStr}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sessions");
      return res.json();
    },
    enabled: expanded,
  });

  const currentSessionIds = sessionsQuery.data?.sessions.map(s => s.sessionId) ?? [];
  const allSelected = currentSessionIds.length > 0 && currentSessionIds.every(id => selectedSessions.has(id));
  const someSelected = selectedSessions.size > 0;

  const toggleSession = (sessionId: string) => {
    setExpandedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
  };

  const toggleSelect = (sessionId: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedSessions(prev => {
        const next = new Set(prev);
        currentSessionIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedSessions(prev => {
        const next = new Set(prev);
        currentSessionIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const invalidateAnalytics = () => {
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === "string" && key.startsWith("/api/analytics");
      },
    });
  };

  const handleResizeCol = useCallback((key: string, width: number) => {
    setColWidths(prev => ({ ...prev, [key]: width }));
  }, []);

  const deleteSession = async (sessionId: string) => {
    setDeletingSession(sessionId);
    try {
      const res = await fetch(`/api/analytics/events/session/${sessionId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete");
      const data = await res.json();
      toast({ title: `Deleted ${data.count} events for this session` });
      setSelectedSessions(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
      invalidateAnalytics();
    } catch {
      toast({ title: "Failed to delete session events", variant: "destructive" });
    } finally {
      setDeletingSession(null);
    }
  };

  const bulkDeleteSelected = async () => {
    if (selectedSessions.size === 0) return;
    setBulkDeleting(true);
    try {
      const sessionIds = Array.from(selectedSessions);
      const res = await fetch("/api/analytics/events/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionIds }),
      });
      if (!res.ok) throw new Error("Failed to delete");
      const data = await res.json();
      toast({ title: `Deleted ${data.count} events from ${sessionIds.length} sessions` });
      setSelectedSessions(new Set());
      setConfirmBulkDelete(false);
      invalidateAnalytics();
    } catch {
      toast({ title: "Failed to bulk delete sessions", variant: "destructive" });
    } finally {
      setBulkDeleting(false);
    }
  };

  const totalCols = SESSION_COLUMNS.length;

  return (
    <div className="border-t pt-2" data-testid="card-event-logs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={onToggleExpanded}
          className="flex items-center gap-1.5 text-left"
          data-testid="button-toggle-logs"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <h3 className="text-[11px] font-semibold">Session Logs</h3>
          {sessionsQuery.data && (
            <Badge variant="secondary" className="text-[9px] py-0 ml-1">{sessionsQuery.data.total.toLocaleString()} sessions</Badge>
          )}
        </button>
        {expanded && someSelected && (
          confirmBulkDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-destructive font-medium">Delete {selectedSessions.size} selected session{selectedSessions.size > 1 ? "s" : ""}?</span>
              <Button variant="destructive" size="sm" onClick={bulkDeleteSelected} disabled={bulkDeleting} data-testid="button-confirm-bulk-delete">
                {bulkDeleting ? "..." : "Yes"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulkDelete(false)} data-testid="button-cancel-bulk-delete">
                No
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmBulkDelete(true)} data-testid="button-bulk-delete">
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="text-[10px]">Delete {selectedSessions.size} selected</span>
            </Button>
          )
        )}
      </div>

      {expanded && (
        <div className="mt-1.5 space-y-1.5">
          <FilterBar filters={filters} onChange={onFiltersChange} filterOptions={filterOptions} />
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

          {sessionsQuery.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : sessionsQuery.data && sessionsQuery.data.sessions.length > 0 ? (
            <>
              <div className="overflow-x-auto border rounded-md">
                <table className="border-collapse" style={{ tableLayout: "fixed", width: "100%", minWidth: `${Object.values(colWidths).reduce((a, b) => a + b, 0)}px` }}>
                  <thead>
                    <tr className="h-6 border-b bg-muted/50">
                      <th
                        className="px-0.5 py-0 whitespace-nowrap"
                        style={{ width: "80px", minWidth: "80px" }}
                      >
                        <div className="flex items-center gap-1">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleSelectAll}
                            className="h-3 w-3"
                            data-testid="checkbox-select-all"
                          />
                          <span className="text-[9px] text-muted-foreground font-medium">Select All</span>
                        </div>
                      </th>
                      <th
                        className="px-0.5 py-0"
                        style={{ width: `${colWidths.expand}px`, minWidth: `${colWidths.expand}px` }}
                      />
                      {SESSION_COLUMNS.slice(2).map(col => (
                        <ResizableHeader
                          key={col.key}
                          colKey={col.key}
                          label={col.label}
                          width={colWidths[col.key]}
                          resizable={col.resizable}
                          onResize={handleResizeCol}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionsQuery.data.sessions.map((session) => (
                      <SessionLogRow
                        key={session.sessionId}
                        session={session}
                        isExpanded={expandedSessions.has(session.sessionId)}
                        isSelected={selectedSessions.has(session.sessionId)}
                        onToggle={() => toggleSession(session.sessionId)}
                        onSelect={() => toggleSelect(session.sessionId)}
                        onDeleteSession={() => deleteSession(session.sessionId)}
                        isDeletingSession={deletingSession === session.sessionId}
                        colWidths={colWidths}
                        totalCols={totalCols}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] text-muted-foreground">
                  {((sessionsQuery.data.page - 1) * sessionsQuery.data.limit) + 1}-{Math.min(sessionsQuery.data.page * sessionsQuery.data.limit, sessionsQuery.data.total)} of {sessionsQuery.data.total.toLocaleString()} sessions
                </p>
                <div className="flex items-center gap-0.5">
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(1)} disabled={sessionsQuery.data.page <= 1} data-testid="button-log-first">
                    <ChevronsLeft className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(p => Math.max(1, p - 1))} disabled={sessionsQuery.data.page <= 1} data-testid="button-log-prev">
                    <ChevronLeft className="w-3 h-3" />
                  </Button>
                  <span className="px-2 text-[10px] font-mono">
                    {sessionsQuery.data.page} / {sessionsQuery.data.totalPages}
                  </span>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(p => Math.min(sessionsQuery.data!.totalPages, p + 1))} disabled={sessionsQuery.data.page >= sessionsQuery.data.totalPages} data-testid="button-log-next">
                    <ChevronRight className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => setLogPage(sessionsQuery.data!.totalPages)} disabled={sessionsQuery.data.page >= sessionsQuery.data.totalPages} data-testid="button-log-last">
                    <ChevronsRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-3 text-center text-muted-foreground text-[11px]">
              {debouncedSearch ? "No sessions match your search." : "No session logs found for the selected filters."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionLogRow({
  session,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onDeleteSession,
  isDeletingSession,
  colWidths,
  totalCols,
}: {
  session: SessionLogEntry;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onDeleteSession: () => void;
  isDeletingSession: boolean;
  colWidths: Record<string, number>;
  totalCols: number;
}) {
  const ts = new Date(session.lastEventAt);
  const formattedDate = format(ts, "MMM d h:mm:ss a");

  const statusBadge = session.maxEventType === "form_complete"
    ? <Badge variant="secondary" className="text-[9px] py-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">Complete</Badge>
    : session.maxStep === 0
    ? <Badge variant="secondary" className="text-[9px] py-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Landed</Badge>
    : <Badge variant="secondary" className="text-[9px] py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">Step {session.maxStep}</Badge>;

  return (
    <>
      <tr
        className={`cursor-pointer hover-elevate h-6 border-b ${isSelected ? "bg-primary/5" : ""}`}
        onClick={onToggle}
        data-testid={`row-session-${session.sessionId}`}
      >
        <td className="px-0.5 py-0" style={{ width: "80px" }} onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="h-3 w-3"
            data-testid={`checkbox-session-${session.sessionId}`}
          />
        </td>
        <td className="px-0.5 py-0" style={{ width: `${colWidths.expand}px` }}>
          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </td>
        <td className="text-[10px] font-mono whitespace-nowrap px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.lastActivity}px` }}>{formattedDate}</td>
        <td className="text-[10px] font-mono truncate px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.sessionId}px` }} title={session.sessionId}>
          {session.sessionId.substring(0, 10)}...
        </td>
        <td className="text-[10px] font-mono px-1 py-0 text-center overflow-hidden" style={{ width: `${colWidths.events}px` }}>
          <Badge variant="outline" className="text-[9px] py-0">{session.eventCount}</Badge>
        </td>
        <td className="text-[10px] font-mono px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.furthestStep}px` }}>{session.maxStep}. {session.maxStepName}</td>
        <td className="px-1 py-0 overflow-hidden" style={{ width: `${colWidths.status}px` }}>{statusBadge}</td>
        <td className="text-[10px] px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.audience}px` }}>{session.page}</td>
        <td className="text-[10px] px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.domain}px` }}>{session.domain}</td>
        <td className="text-[10px] px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.device}px` }}>{session.deviceType || "\u2014"}</td>
        <td className="text-[10px] px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.os}px` }}>{session.os || "\u2014"}</td>
        <td className="text-[10px] px-1 py-0 overflow-hidden text-ellipsis" style={{ width: `${colWidths.browser}px` }}>{session.browser || "\u2014"}</td>
      </tr>
      {isExpanded && (
        <tr data-testid={`row-session-detail-${session.sessionId}`}>
          <td colSpan={totalCols} className="p-0">
            <div className="bg-muted/50 px-3 py-2 space-y-2">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-0.5 text-[10px]">
                <DetailField label="Session ID" value={session.sessionId} />
                <DetailField label="Audience" value={session.page} />
                <DetailField label="Funnel Type" value={session.pageType} />
                <DetailField label="Domain" value={session.domain} />
                <DetailField label="Device" value={session.deviceType || "\u2014"} />
                <DetailField label="OS" value={session.os || "\u2014"} />
                <DetailField label="Browser" value={session.browser || "\u2014"} />
                {session.events[0] && (
                  <>
                    <DetailField label="IP Address" value={session.events[0].ipAddress || "\u2014"} />
                    <DetailField label="Geo State" value={session.events[0].geoState || "\u2014"} />
                    <DetailField label="UTM Source" value={session.events[0].utmSource || "\u2014"} />
                    <DetailField label="UTM Campaign" value={session.events[0].utmCampaign || "\u2014"} />
                    <DetailField label="UTM Medium" value={session.events[0].utmMedium || "\u2014"} />
                    <DetailField label="Referrer" value={session.events[0].referrer || "\u2014"} />
                    <DetailField label="External ID" value={session.events[0].externalId || "\u2014"} />
                    <DetailField label="FBCLID" value={session.events[0].fbclid || "\u2014"} />
                    <DetailField label="FBC" value={session.events[0].fbc || "\u2014"} />
                    <DetailField label="FBP" value={session.events[0].fbp || "\u2014"} />
                    <DetailField label="Campaign Name" value={session.events[0].campaignName || "\u2014"} />
                    <DetailField label="Ad Name" value={session.events[0].adName || "\u2014"} />
                    <DetailField label="Adset Name" value={session.events[0].adsetName || "\u2014"} />
                    <DetailField label="Placement" value={session.events[0].placement || "\u2014"} />
                  </>
                )}
              </div>

              <div>
                <h4 className="text-[10px] font-semibold mb-1">Steps ({session.events.length} events)</h4>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="border-b bg-background/50">
                        <th className="px-1.5 py-1 text-left font-medium text-muted-foreground">Step</th>
                        <th className="px-1.5 py-1 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-1.5 py-1 text-left font-medium text-muted-foreground">Event</th>
                        <th className="px-1.5 py-1 text-left font-medium text-muted-foreground">Value</th>
                        <th className="px-1.5 py-1 text-right font-medium text-muted-foreground">Time on Step</th>
                        <th className="px-1.5 py-1 text-left font-medium text-muted-foreground">Timestamp</th>
                        <th className="px-1.5 py-1 text-left font-medium text-muted-foreground">Event ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.events.map((event) => {
                        const evTs = new Date(event.eventTimestamp);
                        return (
                          <tr key={event.id} className="border-b last:border-0" data-testid={`row-step-${event.id}`}>
                            <td className="px-1.5 py-0.5 font-mono font-semibold">{event.stepNumber}</td>
                            <td className="px-1.5 py-0.5">{event.stepName}</td>
                            <td className="px-1.5 py-0.5">
                              <Badge variant="secondary" className="text-[8px] py-0">{event.eventType || "step_complete"}</Badge>
                            </td>
                            <td className="px-1.5 py-0.5 max-w-[120px] truncate" title={event.selectedValue || ""}>{event.selectedValue || "\u2014"}</td>
                            <td className="px-1.5 py-0.5 text-right font-mono text-muted-foreground">{event.timeOnStep !== null ? `${event.timeOnStep}s` : "\u2014"}</td>
                            <td className="px-1.5 py-0.5 font-mono text-muted-foreground whitespace-nowrap">{format(evTs, "h:mm:ss a")}</td>
                            <td className="px-1.5 py-0.5 font-mono text-muted-foreground max-w-[80px] truncate" title={event.eventId || ""}>{event.eventId || "\u2014"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {session.events.some(e => e.eventType === "form_complete") && (
                <div>
                  <h4 className="text-[10px] font-semibold mb-1">Lead Info</h4>
                  <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-[10px]">
                    {(() => {
                      const fc = session.events.find(e => e.eventType === "form_complete");
                      if (!fc) return null;
                      return (
                        <>
                          <DetailField label="First Name" value={fc.firstName || "\u2014"} />
                          <DetailField label="Last Name" value={fc.lastName || "\u2014"} />
                          <DetailField label="Email" value={fc.email || "\u2014"} />
                          <DetailField label="Phone" value={fc.phone || "\u2014"} />
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {(() => {
                const fcEvent = session.events.find(e => e.eventType === "form_complete" && e.phone);
                if (!fcEvent?.phone) return null;
                return <RetellCallSection phone={fcEvent.phone} />;
              })()}

              {session.events.some(e => e.quizAnswers && Object.keys(e.quizAnswers).length > 0) && (
                <div>
                  <h4 className="text-[10px] font-semibold mb-1">Quiz Answers</h4>
                  <div className="grid grid-cols-4 md:grid-cols-6 gap-x-3 gap-y-0.5 text-[10px]">
                    {(() => {
                      const lastWithAnswers = [...session.events].reverse().find(e => e.quizAnswers && Object.keys(e.quizAnswers).length > 0);
                      if (!lastWithAnswers?.quizAnswers) return null;
                      return Object.entries(lastWithAnswers.quizAnswers).map(([key, val]) => (
                        <DetailField key={key} label={key.charAt(0).toUpperCase() + key.slice(1)} value={val} />
                      ));
                    })()}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(); }}
                  disabled={isDeletingSession}
                  data-testid={`button-delete-session-${session.sessionId}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">{isDeletingSession ? "..." : `Delete session (${session.eventCount} events)`}</span>
                </Button>
              </div>
            </div>
          </td>
        </tr>
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

interface RetellCall {
  callId: string;
  callType: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  callStatus: string;
  agentName: string;
  startTimestamp: number;
  endTimestamp: number;
  durationMs: number;
  transcript: string | null;
  recordingUrl: string | null;
  disconnectionReason: string | null;
  callAnalysis: {
    callSummary: string;
    userSentiment: string;
    callSuccessful: boolean;
    inVoicemail: boolean;
  } | null;
  callCost: {
    totalDurationSeconds: number;
    combinedCost: number;
  } | null;
}

function RetellCallSection({ phone }: { phone: string }) {
  const [calls, setCalls] = useState<RetellCall[]>([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedTranscript, setExpandedTranscript] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/retell/calls?phone=${encodeURIComponent(phone)}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then(data => {
        if (!cancelled) {
          setCalls(data.calls || []);
          setIsBlocked(data.isBlocked || false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) { setError("Could not load call data"); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, [phone]);

  const togglePlay = (call: RetellCall) => {
    if (!call.recordingUrl) return;
    if (playingId === call.callId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(call.recordingUrl);
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => { toast({ title: "Could not play recording", variant: "destructive" }); setPlayingId(null); };
    audio.play();
    audioRef.current = audio;
    setPlayingId(call.callId);
  };

  const downloadRecording = (call: RetellCall) => {
    if (!call.recordingUrl) return;
    const a = document.createElement("a");
    a.href = call.recordingUrl;
    a.download = `retell-call-${call.callId}.wav`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const toggleBlock = async () => {
    try {
      if (isBlocked) {
        await fetch(`/api/retell/block/${encodeURIComponent(phone)}`, { method: "DELETE", credentials: "include" });
        setIsBlocked(false);
        toast({ title: `Unblocked ${phone}` });
      } else {
        await fetch("/api/retell/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ phone, reason: "Blocked from session logs" }),
        });
        setIsBlocked(true);
        toast({ title: `Blocked ${phone}` });
      }
    } catch {
      toast({ title: "Failed to update block status", variant: "destructive" });
    }
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-1">
        <h4 className="text-[10px] font-semibold flex items-center gap-1">
          <Phone className="w-3 h-3" /> Retell Calls
        </h4>
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <h4 className="text-[10px] font-semibold flex items-center gap-1">
          <Phone className="w-3 h-3" /> Retell Calls
        </h4>
        <p className="text-[10px] text-muted-foreground">{error}</p>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const sentimentColor = (s: string) => {
    if (s === "Positive") return "text-green-600 dark:text-green-400";
    if (s === "Negative") return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-1.5" data-testid="section-retell-calls">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold flex items-center gap-1">
          <Phone className="w-3 h-3" /> Retell Calls ({calls.length})
        </h4>
        <Button
          variant={isBlocked ? "destructive" : "outline"}
          size="sm"
          onClick={(e) => { e.stopPropagation(); toggleBlock(); }}
          data-testid="button-toggle-block"
        >
          <Ban className="w-3 h-3 mr-1" />
          <span className="text-[10px]">{isBlocked ? "Unblock Number" : "Block Number"}</span>
        </Button>
      </div>

      {calls.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">No Retell calls found for {phone}</p>
      ) : (
        <div className="space-y-1.5">
          {calls.map((call) => (
            <div key={call.callId} className="border rounded-md p-2 bg-background/50 space-y-1" data-testid={`retell-call-${call.callId}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-[10px]">
                  <Badge variant="secondary" className="text-[8px] py-0">
                    {call.direction}
                  </Badge>
                  <span className="font-mono text-muted-foreground">{call.fromNumber} &rarr; {call.toNumber}</span>
                  {call.durationMs > 0 && (
                    <span className="flex items-center gap-0.5 text-muted-foreground">
                      <Clock className="w-2.5 h-2.5" />
                      {formatDuration(call.durationMs)}
                    </span>
                  )}
                  {call.startTimestamp && (
                    <span className="text-muted-foreground">
                      {format(new Date(call.startTimestamp), "MMM d h:mm a")}
                    </span>
                  )}
                  {call.agentName && <span className="text-muted-foreground">{call.agentName}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {call.recordingUrl ? (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); togglePlay(call); }}
                        data-testid={`button-play-${call.callId}`}
                      >
                        {playingId === call.callId
                          ? <Pause className="w-3.5 h-3.5 text-green-500" />
                          : <Play className="w-3.5 h-3.5 text-green-500" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => { e.stopPropagation(); downloadRecording(call); }}
                        data-testid={`button-download-${call.callId}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground" data-testid={`no-recording-${call.callId}`}>
                      <MinusCircle className="w-3.5 h-3.5 text-red-500" />
                      No recording
                    </span>
                  )}
                  {call.transcript && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); setExpandedTranscript(expandedTranscript === call.callId ? null : call.callId); }}
                      data-testid={`button-transcript-${call.callId}`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {call.callAnalysis && (
                <div className="flex items-center gap-3 text-[9px]">
                  {call.callAnalysis.userSentiment && (
                    <span className={sentimentColor(call.callAnalysis.userSentiment)}>
                      Sentiment: {call.callAnalysis.userSentiment}
                    </span>
                  )}
                  {call.callAnalysis.callSuccessful !== undefined && (
                    <span className={call.callAnalysis.callSuccessful ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {call.callAnalysis.callSuccessful ? "Successful" : "Unsuccessful"}
                    </span>
                  )}
                  {call.callAnalysis.inVoicemail && (
                    <span className="text-yellow-600 dark:text-yellow-400">Voicemail</span>
                  )}
                  {call.disconnectionReason && (
                    <span className="text-muted-foreground">Ended: {call.disconnectionReason.replace(/_/g, " ")}</span>
                  )}
                </div>
              )}

              {call.callAnalysis?.callSummary && (
                <p className="text-[9px] text-muted-foreground leading-tight">{call.callAnalysis.callSummary}</p>
              )}

              {call.callCost && (
                <div className="text-[9px] text-muted-foreground">
                  Cost: ${(call.callCost.combinedCost / 100).toFixed(2)} | Duration: {call.callCost.totalDurationSeconds}s
                </div>
              )}

              {expandedTranscript === call.callId && call.transcript && (
                <div className="mt-1 p-1.5 bg-muted/50 rounded text-[9px] font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto leading-tight" data-testid={`transcript-${call.callId}`}>
                  {call.transcript}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
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
  const savedView = useRef(loadSavedView());

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const sv = savedView.current;
    if (sv.dateRange?.from) {
      return {
        from: new Date(sv.dateRange.from),
        to: sv.dateRange.to ? new Date(sv.dateRange.to) : undefined,
      };
    }
    return undefined;
  });
  const [filters, setFilters] = useState<Filters>(() => savedView.current.filters || emptyFilters);
  const [drillDimension, setDrillDimension] = useState<string>(() => savedView.current.drillDimension || "domain");
  const [refreshInterval, setRefreshInterval] = useState<number>(() => savedView.current.refreshInterval || 0);
  const [logsExpanded, setLogsExpanded] = useState<boolean>(() => savedView.current.logsExpanded || false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const state: SavedViewState = {
      filters,
      drillDimension,
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      } : undefined,
      refreshInterval,
      logsExpanded,
    };
    saveViewState(state);
  }, [filters, drillDimension, dateRange, refreshInterval, logsExpanded]);

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
          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
            <Save className="w-2.5 h-2.5" /> Auto-saved
          </span>
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

      <FunnelReport dateRange={dateRange} filters={filters} drillDimension={drillDimension} onDrillDimensionChange={setDrillDimension} />

      <EventLogsSection
        dateRange={dateRange}
        filters={filters}
        filterOptions={filterOptions}
        onFiltersChange={setFilters}
        expanded={logsExpanded}
        onToggleExpanded={() => setLogsExpanded(prev => !prev)}
      />
    </div>
  );
}
