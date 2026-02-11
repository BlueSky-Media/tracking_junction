import { useState, useEffect, useCallback, useRef, Fragment, type ReactNode } from "react";
import { getLeadStepsForAudience, CALL_STEPS } from "@shared/schema";
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
  MinusCircle, Save, Columns, Info, GripVertical,
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
  stepKey: string;
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
  pageUrl: string | null;
  screenResolution: string | null;
  viewport: string | null;
  language: string | null;
  selectedState: string | null;
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
  utmSource: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  geoState: string | null;
  referrer: string | null;
  pageUrl: string | null;
  screenResolution: string | null;
  viewport: string | null;
  language: string | null;
  selectedState: string | null;
  ipAddress: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  quizAnswers: Record<string, string> | null;
}

interface SessionLogResult {
  sessions: SessionLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Filters {
  domain: string[];
  deviceType: string[];
  page: string[];
  pageType: string[];
  utmSource: string[];
  utmCampaign: string[];
  utmMedium: string[];
  os: string[];
  browser: string[];
  geoState: string[];
}

interface FilterOptions {
  utmSources: string[];
  utmCampaigns: string[];
  utmMediums: string[];
  osList: string[];
  browsers: string[];
  geoStates: string[];
}

const DRILL_DIMENSIONS = [
  { value: "domain", label: "Domain" },
  { value: "deviceType", label: "Device Type" },
  { value: "page", label: "Audience" },
  { value: "utmSource", label: "UTM Source" },
  { value: "utmCampaign", label: "UTM Campaign" },
  { value: "utmMedium", label: "UTM Medium" },
];

function setFilterParam(params: URLSearchParams, key: string, values: string[] | string | undefined) {
  if (!values) return;
  const arr = Array.isArray(values) ? values : (values && values !== "__all__" ? [values] : []);
  if (arr.length > 0) params.set(key, arr.join(","));
}

function isFilterActive(values: string[]): boolean {
  return values.length > 0;
}

function buildQueryParams(dateRange: DateRange | undefined, filters: Filters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  setFilterParam(params, "domain", filters.domain);
  setFilterParam(params, "deviceType", filters.deviceType);
  setFilterParam(params, "audience", filters.page);
  setFilterParam(params, "pageType", filters.pageType);
  setFilterParam(params, "utmSource", filters.utmSource);
  setFilterParam(params, "utmCampaign", filters.utmCampaign);
  setFilterParam(params, "utmMedium", filters.utmMedium);
  setFilterParam(params, "os", filters.os);
  setFilterParam(params, "browser", filters.browser);
  setFilterParam(params, "geoState", filters.geoState);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      params.set(k, v);
    }
  }
  return params.toString();
}

function buildLogsQuery(dateRange: DateRange | undefined, filters: Filters, logPage: number, search: string, logLimit: number = 25): string {
  const params = new URLSearchParams();
  params.set("page", logPage.toString());
  params.set("limit", logLimit.toString());
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  setFilterParam(params, "domain", filters.domain);
  setFilterParam(params, "deviceType", filters.deviceType);
  setFilterParam(params, "audience", filters.page);
  setFilterParam(params, "pageType", filters.pageType);
  setFilterParam(params, "utmSource", filters.utmSource);
  setFilterParam(params, "utmCampaign", filters.utmCampaign);
  setFilterParam(params, "utmMedium", filters.utmMedium);
  setFilterParam(params, "os", filters.os);
  setFilterParam(params, "browser", filters.browser);
  setFilterParam(params, "geoState", filters.geoState);
  if (search.trim()) params.set("search", search.trim());
  return params.toString();
}

const emptyFilters: Filters = {
  domain: [],
  deviceType: [],
  page: [],
  pageType: [],
  utmSource: [],
  utmCampaign: [],
  utmMedium: [],
  os: [],
  browser: [],
  geoState: [],
};

function MultiSelectDropdown({
  label,
  selected,
  options,
  filterKey,
  onChange,
  testId,
}: {
  label: string;
  selected: string[];
  options: { value: string; label: string }[];
  filterKey: keyof Filters;
  onChange: (key: keyof Filters, val: string[]) => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(filterKey, selected.filter(v => v !== val));
    } else {
      onChange(filterKey, [...selected, val]);
    }
  };
  const summary = selected.length === 0
    ? `All ${label}`
    : selected.length === 1
      ? options.find(o => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-7 text-[11px] justify-between font-normal px-2 ${selected.length > 0 ? "border-primary/50" : ""}`}
          data-testid={testId}
        >
          <span className="truncate">{summary}</span>
          <ChevronDown className="w-3 h-3 ml-1 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-1" align="start">
        <div className="max-h-[250px] overflow-y-auto">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1 text-[11px] cursor-pointer hover-elevate rounded-sm"
              data-testid={`${testId}-option-${o.value}`}
            >
              <Checkbox
                checked={selected.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
                className="h-3.5 w-3.5"
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border mt-1 pt-1 px-2 pb-1">
            <button
              onClick={() => onChange(filterKey, [])}
              className="text-[10px] text-muted-foreground cursor-pointer"
              data-testid={`${testId}-clear`}
            >
              Clear selection
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function FilterPanel({
  filters,
  onChange,
  filterOptions,
  testIdPrefix,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  filterOptions: FilterOptions | undefined;
  testIdPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Object.values(filters).filter(v => v.length > 0).length;

  const handleChange = (key: keyof Filters, val: string[]) => {
    onChange({ ...filters, [key]: val });
  };

  return (
    <div data-testid={`${testIdPrefix}-filter-panel`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          variant={open ? "default" : "outline"}
          size="sm"
          onClick={() => setOpen(!open)}
          data-testid={`${testIdPrefix}-toggle-filters`}
        >
          <Filter className="w-3 h-3 mr-1" />
          <span className="text-[10px]">Filters</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-[9px] ml-1 py-0">{activeCount}</Badge>
          )}
        </Button>
        {activeCount > 0 && !open && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyFilters)}
            data-testid={`${testIdPrefix}-clear-filters`}
          >
            <X className="w-3 h-3 mr-1" />
            <span className="text-[10px]">Clear</span>
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-1.5 border rounded-md bg-muted/30 p-2 space-y-2" data-testid={`${testIdPrefix}-filter-dropdown`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-1.5">
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Domain</span>
              <MultiSelectDropdown label="Domains" selected={filters.domain} filterKey="domain" onChange={handleChange} testId={`${testIdPrefix}-filter-domain`} options={[
                { value: "blueskylife.net", label: "blueskylife.net" },
                { value: "blueskylife.io", label: "blueskylife.io" },
              ]} />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Device</span>
              <MultiSelectDropdown label="Devices" selected={filters.deviceType} filterKey="deviceType" onChange={handleChange} testId={`${testIdPrefix}-filter-device`} options={[
                { value: "mobile", label: "Mobile" },
                { value: "desktop", label: "Desktop" },
                { value: "tablet", label: "Tablet" },
              ]} />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Audience</span>
              <MultiSelectDropdown label="Audiences" selected={filters.page} filterKey="page" onChange={handleChange} testId={`${testIdPrefix}-filter-audience`} options={[
                { value: "seniors", label: "Seniors" },
                { value: "veterans", label: "Veterans" },
                { value: "first-responders", label: "First Responders" },
              ]} />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Funnel</span>
              <MultiSelectDropdown label="Types" selected={filters.pageType} filterKey="pageType" onChange={handleChange} testId={`${testIdPrefix}-filter-funnel`} options={[
                { value: "lead", label: "Lead" },
                { value: "call", label: "Call" },
              ]} />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Source</span>
              <MultiSelectDropdown label="Sources" selected={filters.utmSource} filterKey="utmSource" onChange={handleChange} testId={`${testIdPrefix}-filter-source`} options={
                (filterOptions?.utmSources || []).map(s => ({ value: s, label: s }))
              } />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Campaign</span>
              <MultiSelectDropdown label="Campaigns" selected={filters.utmCampaign} filterKey="utmCampaign" onChange={handleChange} testId={`${testIdPrefix}-filter-campaign`} options={
                (filterOptions?.utmCampaigns || []).map(s => ({ value: s, label: s }))
              } />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Medium</span>
              <MultiSelectDropdown label="Mediums" selected={filters.utmMedium} filterKey="utmMedium" onChange={handleChange} testId={`${testIdPrefix}-filter-medium`} options={
                (filterOptions?.utmMediums || []).map(s => ({ value: s, label: s }))
              } />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">OS</span>
              <MultiSelectDropdown label="OS" selected={filters.os} filterKey="os" onChange={handleChange} testId={`${testIdPrefix}-filter-os`} options={
                (filterOptions?.osList || []).map(s => ({ value: s, label: s }))
              } />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">Browser</span>
              <MultiSelectDropdown label="Browsers" selected={filters.browser} filterKey="browser" onChange={handleChange} testId={`${testIdPrefix}-filter-browser`} options={
                (filterOptions?.browsers || []).map(s => ({ value: s, label: s }))
              } />
            </div>
            <div>
              <span className="text-[9px] text-muted-foreground block mb-0.5">State</span>
              <MultiSelectDropdown label="States" selected={filters.geoState} filterKey="geoState" onChange={handleChange} testId={`${testIdPrefix}-filter-state`} options={
                (filterOptions?.geoStates || []).map(s => ({ value: s, label: s }))
              } />
            </div>
          </div>
          <div className="flex items-center gap-2 border-t pt-1.5">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} data-testid={`${testIdPrefix}-close-filters`}>
              <span className="text-[10px]">Close</span>
            </Button>
            {activeCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => onChange(emptyFilters)} data-testid={`${testIdPrefix}-clear-filters-panel`}>
                <X className="w-3 h-3 mr-1" />
                <span className="text-[10px]">Clear All</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const STEP_VIS_KEY = "trackingjunction_step_visibility";

function loadStepVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STEP_VIS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveStepVisibility(vis: Record<string, boolean>) {
  try {
    localStorage.setItem(STEP_VIS_KEY, JSON.stringify(vis));
  } catch {}
}

const DRILLDOWN_METRIC_COLS = [
  { key: "lands", label: "Lands", defaultVisible: true },
  { key: "landCvr", label: "Land CVR", defaultVisible: true },
  { key: "formComplete", label: "Form Complete", defaultVisible: true },
  { key: "formCvr", label: "Form CVR", defaultVisible: true },
];

const DRILLDOWN_METRIC_VIS_KEY = "trackingjunction_drilldown_metrics";

function loadDrilldownMetricVis(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(DRILLDOWN_METRIC_VIS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const defaults: Record<string, boolean> = {};
  DRILLDOWN_METRIC_COLS.forEach(c => { defaults[c.key] = c.defaultVisible; });
  return defaults;
}

function saveDrilldownMetricVis(vis: Record<string, boolean>) {
  try {
    localStorage.setItem(DRILLDOWN_METRIC_VIS_KEY, JSON.stringify(vis));
  } catch {}
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
  const [stepVisibility, setStepVisibility] = useState<Record<string, boolean>>(loadStepVisibility);
  const [stepColSelectorOpen, setStepColSelectorOpen] = useState(false);
  const [metricVis, setMetricVis] = useState<Record<string, boolean>>(loadDrilldownMetricVis);

  const toggleStepVis = useCallback((stepKey: string) => {
    setStepVisibility(prev => {
      const next = { ...prev, [stepKey]: prev[stepKey] === false ? true : false };
      saveStepVisibility(next);
      return next;
    });
  }, []);

  const toggleMetricVis = useCallback((key: string) => {
    setMetricVis(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveDrilldownMetricVis(next);
      return next;
    });
  }, []);

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

  const allSteps = data.totals.steps || [];
  const visibleSteps = allSteps.filter(s => stepVisibility[s.stepKey] !== false);
  const canDrillGlobal = depth < 3 && availableNextDimensions.length > 0;
  const showLands = metricVis.lands !== false;
  const showLandCvr = metricVis.landCvr !== false;
  const showFormComplete = metricVis.formComplete !== false;
  const showFormCvr = metricVis.formCvr !== false;

  return (
    <div className="space-y-1">
      {depth === 0 && (
        <div className="flex items-center gap-1">
          <Popover open={stepColSelectorOpen} onOpenChange={setStepColSelectorOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-drilldown-col-selector">
                <Columns className="w-3 h-3 mr-1" />
                <span className="text-[10px]">Columns</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[220px] p-1.5 max-h-[400px] overflow-y-auto" align="start" data-testid="popover-drilldown-col-selector">
              <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-1">Metric Columns</p>
              {DRILLDOWN_METRIC_COLS.map(col => (
                <label key={col.key} className="flex items-center gap-1.5 px-1 py-0.5 rounded-md hover-elevate cursor-pointer" data-testid={`toggle-metric-${col.key}`}>
                  <Checkbox checked={metricVis[col.key] !== false} onCheckedChange={() => toggleMetricVis(col.key)} className="h-3 w-3" />
                  <span className="text-[10px]">{col.label}</span>
                </label>
              ))}
              <div className="border-t my-1" />
              <p className="text-[10px] font-semibold text-muted-foreground px-1 mb-1">Step Columns</p>
              {allSteps.map(step => (
                <label key={step.stepKey} className="flex items-center gap-1.5 px-1 py-0.5 rounded-md hover-elevate cursor-pointer" data-testid={`toggle-step-${step.stepKey}`}>
                  <Checkbox checked={stepVisibility[step.stepKey] !== false} onCheckedChange={() => toggleStepVis(step.stepKey)} className="h-3 w-3" />
                  <span className="text-[10px]">S{step.stepNumber} {step.stepName}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
          <span className="text-[9px] text-muted-foreground">{visibleSteps.length}/{allSteps.length} steps shown</span>
        </div>
      )}
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="h-6">
            {canDrillGlobal && <TableHead className="w-4 px-0.5 py-0" />}
            <TableHead className="text-[10px] min-w-[70px] px-1 py-0">{dimLabel}</TableHead>
            {showLands && <TableHead className="text-[10px] text-right px-1 py-0 whitespace-nowrap">Lands</TableHead>}
            {showLandCvr && <TableHead className="text-[10px] text-right px-1 py-0 whitespace-nowrap">Land CVR</TableHead>}
            {visibleSteps.map((step) => (
              <TableHead key={`step-${step.stepKey}`} colSpan={4} className="text-[9px] text-center px-0 py-0 border-l border-border/30 whitespace-nowrap">
                <span className="font-semibold">S{step.stepNumber}</span>
                <span className="text-muted-foreground ml-0.5 text-[8px]">{step.stepName}</span>
              </TableHead>
            ))}
            {showFormComplete && <TableHead className="text-[10px] text-right px-1 py-0 border-l border-border/30 whitespace-nowrap">Form Complete</TableHead>}
            {showFormCvr && <TableHead className="text-[10px] text-right px-1 py-0 whitespace-nowrap">Form CVR</TableHead>}
          </TableRow>
          <TableRow className="h-4 bg-muted/30">
            {canDrillGlobal && <TableHead className="px-0.5 py-0" />}
            <TableHead className="px-1 py-0" />
            {showLands && <TableHead className="px-1 py-0" />}
            {showLandCvr && <TableHead className="px-1 py-0" />}
            {visibleSteps.map((step) => (
              <Fragment key={`sh-grp-${step.stepKey}`}>
                <TableHead className="text-[8px] text-right px-0.5 py-0 text-muted-foreground whitespace-nowrap border-l border-border/30">#</TableHead>
                <TableHead className="text-[8px] text-right px-0.5 py-0 text-muted-foreground whitespace-nowrap">CVR</TableHead>
                <TableHead className="text-[8px] text-right px-0.5 py-0 text-muted-foreground whitespace-nowrap">SCVR</TableHead>
                <TableHead className="text-[8px] text-right px-0.5 py-0 text-muted-foreground whitespace-nowrap">Drop-off</TableHead>
              </Fragment>
            ))}
            {showFormComplete && <TableHead className="px-1 py-0 border-l border-border/30" />}
            {showFormCvr && <TableHead className="px-1 py-0" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.rows.map((row) => {
            const isExpanded = !!expandedRows[row.groupValue];
            const canDrill = canDrillGlobal;
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
                allSteps={visibleSteps}
                showLands={showLands}
                showLandCvr={showLandCvr}
                showFormComplete={showFormComplete}
                showFormCvr={showFormCvr}
              />
            );
          })}
          {(() => {
            const totCvr = totalLands > 0 ? (data.totals.formCompletions / totalLands) * 100 : 0;
            return (
              <TableRow className="bg-muted/50 font-semibold border-t h-6" data-testid={`row-totals-${groupBy}-depth${depth}`}>
                {canDrillGlobal && <TableCell className="px-0.5 py-0" />}
                <TableCell className="text-[10px] font-bold px-1 py-0">Totals</TableCell>
                {showLands && <TableCell className="text-right font-mono text-[10px] px-1 py-0 font-bold">{totalLands.toLocaleString()}</TableCell>}
                {showLandCvr && <TableCell className="text-right font-mono text-[10px] px-1 py-0 font-bold">100.0%</TableCell>}
                {visibleSteps.map((step) => {
                  const dropOff = 100 - step.conversionFromPrev;
                  return (
                    <Fragment key={`tc-grp-${step.stepKey}`}>
                      <TableCell className="text-right font-mono text-[10px] px-0.5 py-0 font-bold border-l border-border/30">{step.completions.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-[9px] px-0.5 py-0">{step.conversionFromInitial.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono text-[9px] px-0.5 py-0">{step.conversionFromPrev.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono text-[9px] px-0.5 py-0 text-muted-foreground">{dropOff.toFixed(1)}%</TableCell>
                    </Fragment>
                  );
                })}
                {showFormComplete && <TableCell className="text-right font-mono text-[10px] px-1 py-0 font-bold border-l border-border/30">{data.totals.formCompletions.toLocaleString()}</TableCell>}
                {showFormCvr && <TableCell className={`text-right font-mono text-[10px] px-1 py-0 font-bold ${totCvr > 0 ? "" : "text-muted-foreground"}`}>{totCvr.toFixed(1)}%</TableCell>}
              </TableRow>
            );
          })()}
        </TableBody>
      </Table>
      </div>
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
  allSteps,
  showLands,
  showLandCvr,
  showFormComplete,
  showFormCvr,
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
  allSteps: DrilldownStepData[];
  showLands: boolean;
  showLandCvr: boolean;
  showFormComplete: boolean;
  showFormCvr: boolean;
}) {
  const metricCount = (showLands ? 1 : 0) + (showLandCvr ? 1 : 0) + (showFormComplete ? 1 : 0) + (showFormCvr ? 1 : 0);
  const colSpan = 1 + metricCount + (allSteps.length * 4) + (canDrill ? 1 : 0);
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
        {showLands && <TableCell className="text-right font-mono text-[10px] px-1 py-0">{pageLands.toLocaleString()}</TableCell>}
        {showLandCvr && <TableCell className="text-right font-mono text-[10px] px-1 py-0">{landCvr.toFixed(1)}%</TableCell>}
        {allSteps.map((refStep) => {
          const rowStep = row.steps.find(s => s.stepKey === refStep.stepKey);
          const count = rowStep?.completions || 0;
          const cvrVal = rowStep?.conversionFromInitial || 0;
          const scvrVal = rowStep?.conversionFromPrev || 0;
          const dropOff = 100 - scvrVal;
          return (
            <Fragment key={`rc-grp-${refStep.stepKey}`}>
              <TableCell className="text-right font-mono text-[10px] px-0.5 py-0 border-l border-border/30">{count > 0 ? count.toLocaleString() : "\u2014"}</TableCell>
              <TableCell className={`text-right font-mono text-[9px] px-0.5 py-0 ${count > 0 ? "" : "text-muted-foreground"}`}>{count > 0 ? `${cvrVal.toFixed(1)}%` : ""}</TableCell>
              <TableCell className={`text-right font-mono text-[9px] px-0.5 py-0 ${count > 0 ? "" : "text-muted-foreground"}`}>{count > 0 ? `${scvrVal.toFixed(1)}%` : ""}</TableCell>
              <TableCell className={`text-right font-mono text-[9px] px-0.5 py-0 text-muted-foreground`}>{count > 0 ? `${dropOff.toFixed(1)}%` : ""}</TableCell>
            </Fragment>
          );
        })}
        {showFormComplete && <TableCell className="text-right font-mono text-[10px] px-1 py-0 border-l border-border/30">{row.formCompletions.toLocaleString()}</TableCell>}
        {showFormCvr && <TableCell className={`text-right font-mono text-[10px] px-1 py-0 ${formCvr > 0 ? "" : "text-muted-foreground"}`}>{formCvr.toFixed(1)}%</TableCell>}
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
  filterOptions,
  drillDimension,
  onDrillDimensionChange,
  filters,
  onFiltersChange,
}: {
  dateRange: DateRange | undefined;
  filterOptions: FilterOptions | undefined;
  drillDimension: string;
  onDrillDimensionChange: (d: string) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
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

  const audienceQuery = buildQueryParams(dateRange, filters, { groupBy: "page" });
  const { data: audienceData, isLoading: audienceLoading } = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", "audience-funnel", audienceQuery],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${audienceQuery}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audience funnel");
      return res.json();
    },
  });

  if (summaryLoading || audienceLoading) {
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

  const audienceRows = (audienceData?.rows || [])
    .filter(r => (r.pageLands || r.uniqueViews) > 0)
    .sort((a, b) => (b.pageLands || b.uniqueViews) - (a.pageLands || a.uniqueViews));

  return (
    <div data-testid="card-funnel-report">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <h3 className="text-[11px] font-semibold" data-testid="text-funnel-title">Funnel Summary</h3>
        <FilterPanel filters={filters} onChange={onFiltersChange} filterOptions={filterOptions} testIdPrefix="report" />
      </div>
      <div className="overflow-x-auto border rounded-md mb-2">
        <Table>
          <TableHeader>
            <TableRow className="h-6">
              <TableHead className="text-[10px] text-right px-2 py-0">Total Lands</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Total Events</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Form Complete</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Form CVR</TableHead>
              <TableHead className="text-[10px] text-right px-2 py-0">Audiences</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="h-6">
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-page-lands">{pageLands.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-total-events">{totals.grossViews.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-overall-conversion">{finalCount.toLocaleString()}</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0">{overallConversion.toFixed(1)}%</TableCell>
              <TableCell className="text-right font-mono text-[11px] font-bold px-2 py-0" data-testid="text-audience-count">{audienceRows.length}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {audienceRows.map((audienceRow) => {
        const audLands = audienceRow.pageLands || audienceRow.uniqueViews;
        const audFormComplete = audienceRow.formCompletions;
        const audFormCvr = audLands > 0 ? (audFormComplete / audLands) * 100 : 0;
        const audienceName = audienceRow.groupValue;
        const validSteps = getLeadStepsForAudience(audienceName);
        const validStepNames = new Set(validSteps.map(s => s.name));
        const filteredSteps = audienceRow.steps.filter(step => validStepNames.has(step.stepName));
        const audSteps = filteredSteps.map((step, idx) => {
            const prevCount = idx === 0 ? audLands : filteredSteps[idx - 1].completions;
            const dropOff = prevCount > 0 ? ((prevCount - step.completions) / prevCount) * 100 : 0;
            const cvr = audLands > 0 ? (step.completions / audLands) * 100 : 0;
            const scvr = prevCount > 0 ? (step.completions / prevCount) * 100 : 0;
            return { ...step, dropOff, cvr, scvr, prevCount };
          });

        return (
          <div key={audienceRow.groupValue} className="overflow-x-auto border rounded-md mb-2" data-testid={`funnel-audience-${audienceRow.groupValue}`}>
            <Table>
              <TableHeader>
                <TableRow className="h-5 bg-muted/30">
                  <TableHead colSpan={6} className="text-[10px] px-1.5 py-0 font-semibold capitalize">
                    {audienceRow.groupValue}
                    <span className="text-muted-foreground font-normal ml-2">
                      Lands: {audLands.toLocaleString()}
                      {audFormComplete > 0 && <> | Form Complete: {audFormComplete} | Form CVR: {audFormCvr.toFixed(1)}%</>}
                    </span>
                  </TableHead>
                </TableRow>
                <TableRow className="h-5">
                  <TableHead className="text-[9px] px-1.5 py-0 whitespace-nowrap">Step</TableHead>
                  <TableHead className="text-[9px] px-1.5 py-0 text-right whitespace-nowrap">Count</TableHead>
                  <TableHead className="text-[9px] px-1.5 py-0 text-right whitespace-nowrap">CVR</TableHead>
                  <TableHead className="text-[9px] px-1.5 py-0 text-right whitespace-nowrap">SCVR</TableHead>
                  <TableHead className="text-[9px] px-1.5 py-0 text-right whitespace-nowrap">Drop-off</TableHead>
                  <TableHead className="text-[9px] px-1.5 py-0 whitespace-nowrap">Drop-off Visual</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="h-5 bg-muted/20">
                  <TableCell className="font-mono text-[9px] px-1.5 py-0">0. Landing</TableCell>
                  <TableCell className="font-mono text-[9px] px-1.5 py-0 text-right font-bold">{audLands.toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-[9px] px-1.5 py-0 text-right">100.0%</TableCell>
                  <TableCell className="font-mono text-[9px] px-1.5 py-0 text-right">{"\u2014"}</TableCell>
                  <TableCell className="font-mono text-[9px] px-1.5 py-0 text-right">{"\u2014"}</TableCell>
                  <TableCell className="px-1.5 py-0">
                    <div className="w-full bg-muted rounded-sm h-2.5">
                      <div className="h-2.5 rounded-sm bg-primary" style={{ width: "100%" }} />
                    </div>
                  </TableCell>
                </TableRow>
                {audSteps.map((step) => {
                  const barWidth = audLands > 0 ? Math.max(1, (step.completions / audLands) * 100) : 0;
                  const isHighDropOff = step.dropOff > 50;
                  const isMedDropOff = step.dropOff > 30;
                  return (
                    <TableRow key={step.stepKey} className="h-5" data-testid={`row-funnel-step-${audienceRow.groupValue}-${step.stepNumber}`}>
                      <TableCell className="font-mono text-[9px] px-1.5 py-0 whitespace-nowrap">
                        {step.stepNumber}. {step.stepName}
                      </TableCell>
                      <TableCell className="font-mono text-[9px] px-1.5 py-0 text-right font-bold">
                        {step.completions.toLocaleString()}
                      </TableCell>
                      <TableCell className={`font-mono text-[9px] px-1.5 py-0 text-right ${step.cvr < 30 ? "text-red-500" : step.cvr < 60 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                        {step.cvr.toFixed(1)}%
                      </TableCell>
                      <TableCell className={`font-mono text-[9px] px-1.5 py-0 text-right ${step.scvr < 50 ? "text-red-500" : step.scvr < 70 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                        {step.scvr.toFixed(1)}%
                      </TableCell>
                      <TableCell className={`font-mono text-[9px] px-1.5 py-0 text-right ${isHighDropOff ? "text-red-500 font-bold" : isMedDropOff ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}`}>
                        {step.dropOff.toFixed(1)}%
                      </TableCell>
                      <TableCell className="px-1.5 py-0">
                        <div className="w-full bg-muted rounded-sm h-2.5">
                          <div
                            className={`h-2.5 rounded-sm ${isHighDropOff ? "bg-red-500" : isMedDropOff ? "bg-yellow-500" : "bg-primary"}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        );
      })}

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
  checkbox: 20,
  expand: 20,
  lastActivity: 140,
  sessionId: 110,
  events: 50,
  furthestStep: 110,
  status: 80,
  calls: 50,
  audience: 80,
  domain: 120,
  device: 70,
  os: 70,
  browser: 70,
  utmSource: 90,
  utmCampaign: 120,
  utmMedium: 90,
  geoState: 90,
  referrer: 160,
  pageUrl: 160,
  screenRes: 90,
  viewport: 90,
  language: 90,
  selectedState: 120,
};

const COL_VISIBILITY_KEY = "trackingjunction_col_visibility";
const COL_ORDER_KEY = "trackingjunction_col_order";

function loadColVisibility(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COL_VISIBILITY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const defaults: Record<string, boolean> = {};
  for (const col of SESSION_COLUMNS) {
    if (col.key === "checkbox" || col.key === "expand") continue;
    defaults[col.key] = col.optional ? (col.defaultVisible ?? true) : true;
  }
  return defaults;
}

function saveColVisibility(vis: Record<string, boolean>) {
  try {
    localStorage.setItem(COL_VISIBILITY_KEY, JSON.stringify(vis));
  } catch {}
}

function getCellRenderer(key: string, session: SessionLogEntry, colWidths: Record<string, number>): ReactNode {
  const w = colWidths[key] || 80;
  const style = { width: `${w}px` };
  const cls = "text-[10px] px-1 py-0 overflow-hidden text-ellipsis";

  switch (key) {
    case "lastActivity": {
      const ts = new Date(session.lastEventAt);
      return <td key={key} className={`${cls} font-mono whitespace-nowrap`} style={style}>{format(ts, "MMM d h:mm:ss a")}</td>;
    }
    case "sessionId":
      return <td key={key} className={`${cls} font-mono truncate`} style={style} title={session.sessionId}>{session.sessionId.substring(0, 10)}...</td>;
    case "events":
      return <td key={key} className={`${cls} font-mono text-center`} style={style}><Badge variant="outline" className="text-[9px] py-0">{session.eventCount}</Badge></td>;
    case "furthestStep":
      return <td key={key} className={`${cls} font-mono`} style={style}>{session.maxStep}. {session.maxStepName}</td>;
    case "status": {
      const statusBadge = session.maxEventType === "form_complete"
        ? <Badge variant="secondary" className="text-[9px] py-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30">Complete</Badge>
        : session.maxStep === 0
        ? <Badge variant="secondary" className="text-[9px] py-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Landed</Badge>
        : <Badge variant="secondary" className="text-[9px] py-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">Step {session.maxStep}</Badge>;
      return <td key={key} className="px-1 py-0 overflow-hidden" style={style}>{statusBadge}</td>;
    }
    case "calls": {
      const hasPhone = session.events.some(e => e.eventType === "form_complete" && e.phone);
      return (
        <td key={key} className="px-1 py-0 overflow-hidden text-center" style={style} data-testid={`cell-calls-${session.sessionId}`}>
          {hasPhone ? <Phone className="w-3 h-3 text-green-600 dark:text-green-400 inline-block" /> : <span className="text-[9px] text-muted-foreground">{"\u2014"}</span>}
        </td>
      );
    }
    case "audience":
      return <td key={key} className={cls} style={style}>{session.page}</td>;
    case "domain":
      return <td key={key} className={cls} style={style}>{session.domain}</td>;
    case "device":
      return <td key={key} className={cls} style={style}>{session.deviceType || "\u2014"}</td>;
    case "os":
      return <td key={key} className={cls} style={style}>{session.os || "\u2014"}</td>;
    case "browser":
      return <td key={key} className={cls} style={style}>{session.browser || "\u2014"}</td>;
    case "utmSource":
      return <td key={key} className={cls} style={style}>{session.utmSource || "\u2014"}</td>;
    case "utmCampaign":
      return <td key={key} className={cls} style={style}>{session.utmCampaign || "\u2014"}</td>;
    case "utmMedium":
      return <td key={key} className={cls} style={style}>{session.utmMedium || "\u2014"}</td>;
    case "geoState":
      return <td key={key} className={cls} style={style}>{session.geoState || "\u2014"}</td>;
    case "referrer":
      return <td key={key} className={`${cls} truncate`} style={style} title={session.referrer || ""}>{session.referrer || "\u2014"}</td>;
    case "pageUrl":
      return <td key={key} className={`${cls} truncate`} style={style} title={session.pageUrl || ""}>{session.pageUrl || "\u2014"}</td>;
    case "screenRes":
      return <td key={key} className={cls} style={style}>{session.screenResolution || "\u2014"}</td>;
    case "viewport":
      return <td key={key} className={cls} style={style}>{session.viewport || "\u2014"}</td>;
    case "language":
      return <td key={key} className={cls} style={style}>{session.language || "\u2014"}</td>;
    case "selectedState":
      return <td key={key} className={cls} style={style}>{session.selectedState || "\u2014"}</td>;
    case "ipAddress":
      return <td key={key} className={`${cls} font-mono`} style={style}>{session.ipAddress || "\u2014"}</td>;
    case "firstName":
      return <td key={key} className={cls} style={style}>{session.firstName || "\u2014"}</td>;
    case "lastName":
      return <td key={key} className={cls} style={style}>{session.lastName || "\u2014"}</td>;
    case "email":
      return <td key={key} className={`${cls} truncate`} style={style} title={session.email || ""}>{session.email || "\u2014"}</td>;
    case "phone":
      return <td key={key} className={`${cls} font-mono`} style={style}>{session.phone || "\u2014"}</td>;
    case "quizState":
      return <td key={key} className={cls} style={style}>{session.quizAnswers?.state || session.quizAnswers?.State || "\u2014"}</td>;
    case "quizAge":
      return <td key={key} className={cls} style={style}>{session.quizAnswers?.age || session.quizAnswers?.Age || "\u2014"}</td>;
    case "quizIncome":
      return <td key={key} className={cls} style={style}>{session.quizAnswers?.income || session.quizAnswers?.Income || session.quizAnswers?.["Monthly Income"] || session.quizAnswers?.monthly_income || "\u2014"}</td>;
    case "quizBudget":
      return <td key={key} className={cls} style={style}>{session.quizAnswers?.budget || session.quizAnswers?.Budget || session.quizAnswers?.["Budget Affordability"] || session.quizAnswers?.budget_affordability || "\u2014"}</td>;
    case "quizBeneficiary":
      return <td key={key} className={cls} style={style}>{session.quizAnswers?.beneficiary || session.quizAnswers?.Beneficiary || "\u2014"}</td>;
    default:
      return <td key={key} className={cls} style={style}>{"\u2014"}</td>;
  }
}

const STORAGE_KEY = "trackingjunction_view_state";

interface SavedViewState {
  filters: Filters;
  logsFilters?: Filters;
  drillDimension: string;
  dateRange?: { from?: string; to?: string };
  refreshInterval: number;
  logsExpanded: boolean;
}

function migrateFilters(saved: any): Filters | undefined {
  if (!saved) return undefined;
  const result: any = {};
  for (const key of Object.keys(emptyFilters)) {
    const val = saved[key];
    if (Array.isArray(val)) {
      result[key] = val;
    } else if (typeof val === "string" && val && val !== "__all__") {
      result[key] = [val];
    } else {
      result[key] = [];
    }
  }
  return result as Filters;
}

function loadSavedView(): Partial<SavedViewState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed.filters) {
      parsed.filters = migrateFilters(parsed.filters);
    }
    if (parsed.logsFilters) {
      parsed.logsFilters = migrateFilters(parsed.logsFilters);
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveViewState(state: SavedViewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

interface SessionColumn {
  key: string;
  label: string;
  resizable: boolean;
  optional?: boolean;
  defaultVisible?: boolean;
}

const SESSION_COLUMNS: SessionColumn[] = [
  { key: "checkbox", label: "", resizable: false },
  { key: "expand", label: "", resizable: false },
  { key: "lastActivity", label: "Last Activity", resizable: true },
  { key: "sessionId", label: "Session ID", resizable: true },
  { key: "events", label: "Events", resizable: true, optional: true, defaultVisible: true },
  { key: "furthestStep", label: "Furthest Step", resizable: true, optional: true, defaultVisible: true },
  { key: "status", label: "Status", resizable: true, optional: true, defaultVisible: true },
  { key: "calls", label: "Calls", resizable: true, optional: true, defaultVisible: true },
  { key: "audience", label: "Audience", resizable: true, optional: true, defaultVisible: true },
  { key: "domain", label: "Domain", resizable: true, optional: true, defaultVisible: true },
  { key: "device", label: "Device", resizable: true, optional: true, defaultVisible: true },
  { key: "os", label: "OS", resizable: true, optional: true, defaultVisible: true },
  { key: "browser", label: "Browser", resizable: true, optional: true, defaultVisible: true },
  { key: "ipAddress", label: "IP Address", resizable: true, optional: true, defaultVisible: false },
  { key: "geoState", label: "Geo State", resizable: true, optional: true, defaultVisible: false },
  { key: "selectedState", label: "User State", resizable: true, optional: true, defaultVisible: false },
  { key: "firstName", label: "First Name", resizable: true, optional: true, defaultVisible: false },
  { key: "lastName", label: "Last Name", resizable: true, optional: true, defaultVisible: false },
  { key: "email", label: "Email", resizable: true, optional: true, defaultVisible: false },
  { key: "phone", label: "Phone", resizable: true, optional: true, defaultVisible: false },
  { key: "quizState", label: "Quiz: State", resizable: true, optional: true, defaultVisible: false },
  { key: "quizAge", label: "Quiz: Age", resizable: true, optional: true, defaultVisible: false },
  { key: "quizIncome", label: "Quiz: Income", resizable: true, optional: true, defaultVisible: false },
  { key: "quizBudget", label: "Quiz: Budget", resizable: true, optional: true, defaultVisible: false },
  { key: "quizBeneficiary", label: "Quiz: Beneficiary", resizable: true, optional: true, defaultVisible: false },
  { key: "utmSource", label: "UTM Source", resizable: true, optional: true, defaultVisible: false },
  { key: "utmCampaign", label: "UTM Campaign", resizable: true, optional: true, defaultVisible: false },
  { key: "utmMedium", label: "UTM Medium", resizable: true, optional: true, defaultVisible: false },
  { key: "referrer", label: "Referrer", resizable: true, optional: true, defaultVisible: false },
  { key: "pageUrl", label: "Page URL", resizable: true, optional: true, defaultVisible: false },
  { key: "screenRes", label: "Screen", resizable: true, optional: true, defaultVisible: false },
  { key: "viewport", label: "Viewport", resizable: true, optional: true, defaultVisible: false },
  { key: "language", label: "Language", resizable: true, optional: true, defaultVisible: false },
];

const REORDERABLE_KEYS = SESSION_COLUMNS.filter(c => c.key !== "checkbox" && c.key !== "expand").map(c => c.key);

function loadColOrder(): string[] {
  try {
    const raw = localStorage.getItem(COL_ORDER_KEY);
    if (raw) {
      const saved: string[] = JSON.parse(raw);
      const savedSet = new Set(saved);
      const missing = REORDERABLE_KEYS.filter(k => !savedSet.has(k));
      const valid = saved.filter(k => REORDERABLE_KEYS.includes(k));
      return [...valid, ...missing];
    }
  } catch {}
  return [...REORDERABLE_KEYS];
}

function saveColOrder(order: string[]) {
  try {
    localStorage.setItem(COL_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

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
  filterOptions,
  filters,
  onFiltersChange,
  expanded,
  onToggleExpanded,
}: {
  dateRange: DateRange | undefined;
  filterOptions: FilterOptions | undefined;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const [logPage, setLogPage] = useState(1);
  const [logLimit, setLogLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({ ...DEFAULT_COL_WIDTHS });
  const [colVisibility, setColVisibility] = useState<Record<string, boolean>>(loadColVisibility);
  const [colOrder, setColOrder] = useState<string[]>(loadColOrder);
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
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

  const logsQueryStr = buildLogsQuery(dateRange, filters, logPage, debouncedSearch, logLimit);
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

  const toggleColVisibility = useCallback((key: string) => {
    setColVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      saveColVisibility(next);
      return next;
    });
  }, []);

  const colMap = Object.fromEntries(SESSION_COLUMNS.map(c => [c.key, c]));
  const visibleColumns = [
    colMap["checkbox"],
    colMap["expand"],
    ...colOrder
      .filter(key => {
        const col = colMap[key];
        if (!col) return false;
        if (!col.optional) return true;
        return colVisibility[key] !== false;
      })
      .map(key => colMap[key]),
  ].filter(Boolean) as SessionColumn[];

  const visibleColumnKeys = visibleColumns.map(c => c.key);

  const enabledOrderedKeys = colOrder.filter(key => {
    const col = colMap[key];
    if (!col) return false;
    if (!col.optional) return true;
    return colVisibility[key] !== false;
  });

  const disabledKeys = colOrder.filter(key => {
    const col = colMap[key];
    return col?.optional && colVisibility[key] === false;
  });

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

  const totalCols = visibleColumns.length;

  return (
    <div className="border-t pt-2" data-testid="card-event-logs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
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
          {expanded && (
            <Popover open={colSelectorOpen} onOpenChange={(open) => { setColSelectorOpen(open); if (!open) { setDragIdx(null); setDragOverIdx(null); } }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" data-testid="button-column-selector">
                  <Columns className="w-3.5 h-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[220px] p-2 max-h-[70vh] overflow-y-auto" align="start" data-testid="popover-column-selector">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-semibold">Manage Fields</p>
                  <button onClick={() => setColSelectorOpen(false)} className="text-muted-foreground" data-testid="button-close-manage-fields">
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <p className="text-[9px] text-muted-foreground font-medium px-0.5 mb-0.5">Fields in Table</p>
                <div className="space-y-0.5 mb-2">
                  {enabledOrderedKeys.map((key, idx) => {
                    const col = colMap[key];
                    if (!col) return null;
                    const isFixed = !col.optional;
                    return (
                      <div
                        key={key}
                        draggable={!isFixed}
                        onDragStart={(e) => {
                          if (isFixed) { e.preventDefault(); return; }
                          setDragIdx(idx);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverIdx(idx);
                        }}
                        onDragLeave={() => setDragOverIdx(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
                          const allEnabled = colOrder.filter(k => {
                            const c = colMap[k];
                            if (!c) return false;
                            if (!c.optional) return true;
                            return colVisibility[k] !== false;
                          });
                          const dragKey = allEnabled[dragIdx];
                          const newEnabled = allEnabled.filter((_, i) => i !== dragIdx);
                          newEnabled.splice(idx, 0, dragKey);
                          const disabledInOrder = colOrder.filter(k => {
                            const c = colMap[k];
                            return c?.optional && colVisibility[k] === false;
                          });
                          const newOrder = [...newEnabled, ...disabledInOrder];
                          setColOrder(newOrder);
                          saveColOrder(newOrder);
                          setDragIdx(null);
                          setDragOverIdx(null);
                        }}
                        onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                        className={`flex items-center gap-1 px-1 py-0.5 rounded-md ${
                          dragOverIdx === idx ? "border border-primary bg-primary/10" : ""
                        } ${dragIdx === idx ? "opacity-40" : ""} ${!isFixed ? "cursor-grab" : ""}`}
                        data-testid={`field-enabled-${key}`}
                      >
                        {!isFixed && <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                        {isFixed && <div className="w-3 flex-shrink-0" />}
                        <Checkbox
                          checked={true}
                          onCheckedChange={() => {
                            if (isFixed) return;
                            toggleColVisibility(key);
                          }}
                          disabled={isFixed}
                          className="h-3 w-3 flex-shrink-0"
                        />
                        <span className="text-[10px] flex-1">{col.label}</span>
                      </div>
                    );
                  })}
                </div>

                {disabledKeys.length > 0 && (
                  <>
                    <p className="text-[9px] text-muted-foreground font-medium px-0.5 mb-0.5">Add Fields</p>
                    <div className="space-y-0.5">
                      {disabledKeys.map(key => {
                        const col = colMap[key];
                        if (!col) return null;
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-1 px-1 py-0.5 rounded-md hover-elevate cursor-pointer"
                            data-testid={`field-disabled-${key}`}
                          >
                            <div className="w-3 flex-shrink-0" />
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => toggleColVisibility(key)}
                              className="h-3 w-3 flex-shrink-0"
                            />
                            <span className="text-[10px] flex-1">{col.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          )}
        </div>
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
          <FilterPanel filters={filters} onChange={onFiltersChange} filterOptions={filterOptions} testIdPrefix="logs" />
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
                <table className="border-collapse" style={{ tableLayout: "fixed", width: "100%", minWidth: `${visibleColumns.reduce((a, c) => a + (colWidths[c.key] || 80), 0)}px` }}>
                  <thead>
                    <tr className="h-6 border-b bg-muted/50">
                      <th
                        className="px-0.5 py-0"
                        style={{ width: "20px", minWidth: "20px" }}
                      >
                        <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleSelectAll}
                            className="h-3 w-3"
                            data-testid="checkbox-select-all"
                          />
                      </th>
                      <th
                        className="px-0.5 py-0"
                        style={{ width: `${colWidths.expand}px`, minWidth: `${colWidths.expand}px` }}
                      />
                      {visibleColumns.filter(c => c.key !== "checkbox" && c.key !== "expand").map(col => (
                        <ResizableHeader
                          key={col.key}
                          colKey={col.key}
                          label={col.label}
                          width={colWidths[col.key] || 80}
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
                        visibleColumnKeys={visibleColumnKeys}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    {((sessionsQuery.data.page - 1) * sessionsQuery.data.limit) + 1}-{Math.min(sessionsQuery.data.page * sessionsQuery.data.limit, sessionsQuery.data.total)} of {sessionsQuery.data.total.toLocaleString()} sessions
                  </p>
                  <Select value={logLimit.toString()} onValueChange={(v) => { setLogLimit(parseInt(v)); setLogPage(1); }}>
                    <SelectTrigger className="h-6 w-[70px] text-[10px]" data-testid="select-page-size">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-[9px] text-muted-foreground">per page</span>
                </div>
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
  visibleColumnKeys,
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
  visibleColumnKeys: string[];
}) {
  const dataCols = visibleColumnKeys.filter(k => k !== "checkbox" && k !== "expand");

  return (
    <>
      <tr
        className={`cursor-pointer hover-elevate h-6 border-b ${isSelected ? "bg-primary/5" : ""}`}
        onClick={onToggle}
        data-testid={`row-session-${session.sessionId}`}
      >
        <td className="px-0.5 py-0" style={{ width: "20px" }} onClick={(e) => e.stopPropagation()}>
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
        {dataCols.map(key => getCellRenderer(key, session, colWidths))}
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
                {session.events.length > 0 && (() => {
                  const ev = session.events;
                  const find = (fn: (e: EventLog) => string | null | undefined) => {
                    for (const e of ev) { const v = fn(e); if (v) return v; }
                    return "\u2014";
                  };
                  return (
                    <>
                      <DetailField label="IP Address" value={find(e => e.ipAddress)} />
                      <DetailField label="Geo State" value={find(e => e.geoState)} />
                      <DetailField label="UTM Source" value={find(e => e.utmSource)} />
                      <DetailField label="UTM Campaign" value={find(e => e.utmCampaign)} />
                      <DetailField label="UTM Medium" value={find(e => e.utmMedium)} />
                      <DetailField label="Referrer" value={find(e => e.referrer)} />
                      <DetailField label="External ID" value={find(e => e.externalId)} />
                      <DetailField label="FBCLID" value={find(e => e.fbclid)} />
                      <DetailField label="FBC" value={find(e => e.fbc)} />
                      <DetailField label="FBP" value={find(e => e.fbp)} />
                      <DetailField label="Campaign Name" value={find(e => e.campaignName)} />
                      <DetailField label="Ad Name" value={find(e => e.adName)} />
                      <DetailField label="Adset Name" value={find(e => e.adsetName)} />
                      <DetailField label="Placement" value={find(e => e.placement)} />
                      <DetailField label="Page URL" value={find(e => e.pageUrl)} />
                      <DetailField label="Screen Resolution" value={find(e => e.screenResolution)} />
                      <DetailField label="Viewport" value={find(e => e.viewport)} />
                      <DetailField label="Language" value={find(e => e.language)} />
                      <DetailField label="Selected State" value={find(e => e.selectedState)} />
                    </>
                  );
                })()}
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

  if (error || calls.length === 0) {
    return null;
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
                        size="sm"
                        variant={playingId === call.callId ? "default" : "outline"}
                        onClick={(e) => { e.stopPropagation(); togglePlay(call); }}
                        data-testid={`button-play-${call.callId}`}
                      >
                        {playingId === call.callId
                          ? <><Pause className="w-3 h-3 mr-1" /><span className="text-[9px]">Pause</span></>
                          : <><Play className="w-3 h-3 mr-1 text-green-500" /><span className="text-[9px]">Listen</span></>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); downloadRecording(call); }}
                        data-testid={`button-download-${call.callId}`}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        <span className="text-[9px]">Download</span>
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
  const [reportFilters, setReportFilters] = useState<Filters>(() => savedView.current.filters || emptyFilters);
  const [logsFilters, setLogsFilters] = useState<Filters>(() => savedView.current.logsFilters || emptyFilters);
  const [drillDimension, setDrillDimension] = useState<string>(() => savedView.current.drillDimension || "domain");
  const [refreshInterval, setRefreshInterval] = useState<number>(() => savedView.current.refreshInterval || 0);
  const [logsExpanded, setLogsExpanded] = useState<boolean>(() => savedView.current.logsExpanded || false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const state: SavedViewState = {
      filters: reportFilters,
      logsFilters,
      drillDimension,
      dateRange: dateRange ? {
        from: dateRange.from?.toISOString(),
        to: dateRange.to?.toISOString(),
      } : undefined,
      refreshInterval,
      logsExpanded,
    };
    saveViewState(state);
  }, [reportFilters, logsFilters, drillDimension, dateRange, refreshInterval, logsExpanded]);

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

      <FunnelReport dateRange={dateRange} filterOptions={filterOptions} filters={reportFilters} onFiltersChange={setReportFilters} drillDimension={drillDimension} onDrillDimensionChange={setDrillDimension} />

      <EventLogsSection
        dateRange={dateRange}
        filterOptions={filterOptions}
        filters={logsFilters}
        onFiltersChange={setLogsFilters}
        expanded={logsExpanded}
        onToggleExpanded={() => setLogsExpanded(prev => !prev)}
      />
    </div>
  );
}
