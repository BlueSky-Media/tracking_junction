import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
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
  Globe, Monitor, Megaphone, Tag, Link2, Users,
} from "lucide-react";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";

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

const DIMENSION_OPTIONS = [
  { value: "domain", label: "Domain", icon: Globe },
  { value: "deviceType", label: "Device Type", icon: Monitor },
  { value: "page", label: "Audience", icon: Users },
  { value: "utmSource", label: "UTM Source", icon: Link2 },
  { value: "utmCampaign", label: "UTM Campaign", icon: Megaphone },
  { value: "utmMedium", label: "UTM Medium", icon: Tag },
];

function buildDateQuery(dateRange: DateRange | undefined): string {
  const params = new URLSearchParams();
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  return params.toString();
}

function buildDrilldownQuery(dateRange: DateRange | undefined, groupBy: string, parentFilter?: { key: string; value: string }): string {
  const params = new URLSearchParams();
  params.set("groupBy", groupBy);
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  if (parentFilter) {
    const filterValue = parentFilter.value === "(none)" || parentFilter.value === "(unknown)" ? "" : parentFilter.value;
    params.set(parentFilter.key, filterValue);
  }
  return params.toString();
}

function buildLogsQuery(dateRange: DateRange | undefined, logPage: number, search: string): string {
  const params = new URLSearchParams();
  params.set("page", logPage.toString());
  params.set("limit", "25");
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
  if (search.trim()) params.set("search", search.trim());
  return params.toString();
}

function OverallSummary({ dateRange }: { dateRange: DateRange | undefined }) {
  const query = buildDrilldownQuery(dateRange, "domain");

  const { data, isLoading } = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", "overall-summary", query],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <Card className="p-5" data-testid="card-overall-summary">
        <Skeleton className="h-5 w-48 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const totals = data.totals;
  const lastStep = totals.steps[totals.steps.length - 1];
  const overallConversion = lastStep ? lastStep.conversionFromInitial : 0;
  const totalSteps = totals.steps.length;

  return (
    <Card className="p-5" data-testid="card-overall-summary">
      <h3 className="font-semibold mb-4" data-testid="text-overall-summary-title">Overall Funnel Summary</h3>
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
          <p className="text-2xl font-bold font-mono" data-testid="text-total-steps">{totalSteps}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {totals.steps.map((s) => (
                <TableHead key={`overall-step-${s.stepNumber}`} className="text-center min-w-[100px]">
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
                <TableCell key={`overall-val-${s.stepNumber}`} className="text-center">
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
    </Card>
  );
}

function DimensionSection({ dimension, dateRange }: {
  dimension: typeof DIMENSION_OPTIONS[number];
  dateRange: DateRange | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = dimension.icon;

  const query = buildDrilldownQuery(dateRange, dimension.value);

  const { data, isLoading } = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", dimension.value, query],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drilldown");
      return res.json();
    },
    enabled: expanded,
  });

  return (
    <Card className="overflow-hidden" data-testid={`card-dimension-${dimension.value}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full text-left px-5 py-4"
        data-testid={`button-expand-${dimension.value}`}
      >
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className="font-semibold text-sm">{dimension.label}</span>
        {data && (
          <Badge variant="secondary" className="ml-auto text-xs">{data.rows.length} values</Badge>
        )}
      </button>

      {expanded && (
        <div className="border-t">
          {isLoading ? (
            <div className="p-5 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8 pl-5" />
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">{dimension.label}</TableHead>
                    <TableHead className="text-right min-w-[80px]">Sessions</TableHead>
                    <TableHead className="text-right min-w-[80px]">Events</TableHead>
                    {data.totals.steps.map((s) => (
                      <TableHead key={`header-${dimension.value}-${s.stepNumber}`} className="text-center min-w-[90px]">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-semibold">{s.stepName}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <ExpandableRow
                      key={row.groupValue}
                      row={row}
                      dimension={dimension}
                      dateRange={dateRange}
                      allSteps={data.totals.steps}
                    />
                  ))}
                  <TableRow className="bg-muted/50 font-semibold border-t-2" data-testid={`row-dimension-totals-${dimension.value}`}>
                    <TableCell className="pl-5" />
                    <TableCell className="sticky left-0 z-10 bg-muted/50 font-bold">Totals</TableCell>
                    <TableCell className="text-right font-mono">{data.totals.uniqueViews.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{data.totals.grossViews.toLocaleString()}</TableCell>
                    {data.totals.steps.map((step) => (
                      <TableCell key={`totals-${dimension.value}-${step.stepNumber}`} className="text-center">
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
          ) : (
            <div className="p-5 text-center text-muted-foreground text-sm">
              No data available for this dimension.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ExpandableRow({ row, dimension, dateRange, allSteps }: {
  row: DrilldownRow;
  dimension: typeof DIMENSION_OPTIONS[number];
  dateRange: DateRange | undefined;
  allSteps: DrilldownStepData[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [subDimension, setSubDimension] = useState<string>("");

  const availableDimensions = DIMENSION_OPTIONS.filter(d => d.value !== dimension.value);

  const parentFilter = { key: dimension.value, value: row.groupValue };
  const subQuery = subDimension ? buildDrilldownQuery(dateRange, subDimension, parentFilter) : "";

  const subData = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", "sub", subDimension, subQuery],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${subQuery}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sub-drilldown");
      return res.json();
    },
    enabled: expanded && !!subDimension,
  });

  return (
    <>
      <TableRow
        className="cursor-pointer hover-elevate"
        onClick={() => setExpanded(!expanded)}
        data-testid={`row-dimension-${dimension.value}-${row.groupValue}`}
      >
        <TableCell className="pl-5 w-8">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </TableCell>
        <TableCell className="sticky left-0 z-10 bg-background font-medium">{row.groupValue}</TableCell>
        <TableCell className="text-right font-mono">{row.uniqueViews.toLocaleString()}</TableCell>
        <TableCell className="text-right font-mono text-muted-foreground">{row.grossViews.toLocaleString()}</TableCell>
        {row.steps.map((step) => {
          const isLowConv = step.conversionFromPrev < 50 && step.conversionFromPrev > 0;
          return (
            <TableCell key={`${row.groupValue}-step-${step.stepNumber}`} className="text-center">
              <div className="space-y-0.5">
                <p className="font-mono text-xs">{step.completions.toLocaleString()}</p>
                <p className={`font-mono text-xs ${isLowConv ? "text-destructive" : "text-muted-foreground"}`}>
                  {step.conversionFromInitial.toFixed(1)}%
                </p>
              </div>
            </TableCell>
          );
        })}
      </TableRow>

      {expanded && (
        <TableRow data-testid={`row-drilldown-expanded-${dimension.value}-${row.groupValue}`}>
          <TableCell colSpan={4 + allSteps.length} className="p-0">
            <div className="bg-muted/30 border-y px-5 py-4 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium">Drill down</span>
                <Badge variant="outline" className="text-xs">{row.groupValue}</Badge>
                <span className="text-sm text-muted-foreground">by</span>
                <Select value={subDimension} onValueChange={setSubDimension}>
                  <SelectTrigger className="w-[180px]" data-testid={`select-subdimension-${row.groupValue}`}>
                    <SelectValue placeholder="Select metric..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDimensions.map((d) => (
                      <SelectItem key={d.value} value={d.value} data-testid={`option-sub-${d.value}`}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {subDimension && subData.isLoading && (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              )}

              {subDimension && subData.data && subData.data.rows.length > 0 && (
                <div className="overflow-x-auto border rounded-md bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[120px]">
                          {DIMENSION_OPTIONS.find(d => d.value === subDimension)?.label}
                        </TableHead>
                        <TableHead className="text-right min-w-[70px]">Sessions</TableHead>
                        <TableHead className="text-right min-w-[70px]">Events</TableHead>
                        {subData.data.totals.steps.map((s) => (
                          <TableHead key={`sub-header-${s.stepNumber}`} className="text-center min-w-[80px]">
                            <span className="text-xs">{s.stepName}</span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subData.data.rows.map((subRow) => (
                        <TableRow key={subRow.groupValue} data-testid={`row-sub-${subRow.groupValue}`}>
                          <TableCell className="font-medium text-sm">{subRow.groupValue}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{subRow.uniqueViews.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">{subRow.grossViews.toLocaleString()}</TableCell>
                          {subRow.steps.map((step) => {
                            const isLow = step.conversionFromPrev < 50 && step.conversionFromPrev > 0;
                            return (
                              <TableCell key={`sub-${subRow.groupValue}-${step.stepNumber}`} className="text-center">
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
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {subDimension && subData.data && subData.data.rows.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No sub-breakdown data available.</p>
              )}

              {!subDimension && (
                <p className="text-sm text-muted-foreground">Select a metric above to see a detailed breakdown for {row.groupValue}.</p>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function EventLogsSection({
  dateRange,
}: {
  dateRange: DateRange | undefined;
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

  const logsQuery = useQuery<EventLogResult>({
    queryKey: ["/api/analytics/logs", buildLogsQuery(dateRange, logPage, debouncedSearch)],
    queryFn: async () => {
      const q = buildLogsQuery(dateRange, logPage, debouncedSearch);
      const res = await fetch(`/api/analytics/logs?${q}`, { credentials: "include" });
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
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLogPage(1)}
                    disabled={logsQuery.data.page <= 1}
                    data-testid="button-log-first"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    disabled={logsQuery.data.page <= 1}
                    data-testid="button-log-prev"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="px-3 text-sm font-mono">
                    {logsQuery.data.page} / {logsQuery.data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLogPage(p => Math.min(logsQuery.data!.totalPages, p + 1))}
                    disabled={logsQuery.data.page >= logsQuery.data.totalPages}
                    data-testid="button-log-next"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setLogPage(logsQuery.data!.totalPages)}
                    disabled={logsQuery.data.page >= logsQuery.data.totalPages}
                    data-testid="button-log-last"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {debouncedSearch ? "No records match your search." : "No event logs found for the selected date range."}
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

export default function ReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
          <BarChart3 className="w-6 h-6" />
          Drill-Down Reports
        </h1>
        <p className="text-sm text-muted-foreground">Expand any dimension to see its breakdown, then drill further into individual rows</p>
      </div>

      <Card className="p-4">
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
      </Card>

      <OverallSummary dateRange={dateRange} />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold" data-testid="text-dimensions-heading">Breakdown by Dimension</h2>
        {DIMENSION_OPTIONS.map((dim) => (
          <DimensionSection key={dim.value} dimension={dim} dateRange={dateRange} />
        ))}
      </div>

      <EventLogsSection dateRange={dateRange} />
    </div>
  );
}
