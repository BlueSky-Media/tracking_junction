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

const GROUP_OPTIONS = [
  { value: "domain", label: "Domain" },
  { value: "deviceType", label: "Device Type" },
  { value: "utmSource", label: "UTM Source" },
  { value: "utmCampaign", label: "UTM Campaign" },
  { value: "utmMedium", label: "UTM Medium" },
  { value: "page", label: "Audience" },
];

function buildReportQuery(dateRange: DateRange | undefined, groupBy: string): string {
  const params = new URLSearchParams();
  params.set("groupBy", groupBy);
  if (dateRange?.from) params.set("startDate", format(dateRange.from, "yyyy-MM-dd"));
  if (dateRange?.to) params.set("endDate", format(dateRange.to, "yyyy-MM-dd"));
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

function DrilldownSummaryTable({ data, isLoading }: { data: DrilldownResult | undefined; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-2" />
        ))}
      </Card>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Summary</h3>
        <div className="py-12 text-center text-muted-foreground">
          No data available for the selected date range.
        </div>
      </Card>
    );
  }

  const groupLabel = GROUP_OPTIONS.find(o => o.value === data.groupBy)?.label || data.groupBy;
  const steps = data.totals.steps;

  return (
    <Card className="p-5" data-testid="card-drilldown-summary">
      <h3 className="font-semibold mb-4" data-testid="text-summary-title">Summary</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[140px]">{groupLabel}</TableHead>
              <TableHead className="text-right min-w-[90px]">Unique Views</TableHead>
              <TableHead className="text-right min-w-[90px]">Gross Views</TableHead>
              {steps.map((s) => (
                <TableHead key={`header-group-${s.stepNumber}`} className="text-center min-w-[160px]" colSpan={3}>
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-semibold">Step {s.stepNumber}</span>
                    <span className="text-xs text-muted-foreground font-normal">{s.stepName}</span>
                  </div>
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10" />
              <TableHead />
              <TableHead />
              {steps.map((s) => (
                <SubHeaders key={`subheader-${s.stepNumber}`} />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <DrilldownDataRow key={row.groupValue} row={row} />
            ))}
            <DrilldownDataRow row={data.totals} isTotals />
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function SubHeaders() {
  return (
    <>
      <TableHead className="text-right text-xs min-w-[50px]">#</TableHead>
      <TableHead className="text-right text-xs min-w-[55px]">Step %</TableHead>
      <TableHead className="text-right text-xs min-w-[55px]">CVR %</TableHead>
    </>
  );
}

function DrilldownDataRow({ row, isTotals }: { row: DrilldownRow; isTotals?: boolean }) {
  return (
    <TableRow
      className={isTotals ? "bg-muted/50 font-semibold border-t-2" : ""}
      data-testid={`row-drilldown-${isTotals ? "totals" : row.groupValue}`}
    >
      <TableCell className={`sticky left-0 z-10 ${isTotals ? "bg-muted/50 font-bold" : "bg-background font-medium"}`}>
        {row.groupValue}
      </TableCell>
      <TableCell className="text-right font-mono">{row.uniqueViews.toLocaleString()}</TableCell>
      <TableCell className="text-right font-mono text-muted-foreground">{row.grossViews.toLocaleString()}</TableCell>
      {row.steps.map((step) => (
        <StepCells key={`${row.groupValue}-step-${step.stepNumber}`} step={step} />
      ))}
    </TableRow>
  );
}

function StepCells({ step }: { step: DrilldownStepData }) {
  const isLowConv = step.conversionFromPrev < 50 && step.conversionFromPrev > 0;
  return (
    <>
      <TableCell className="text-right font-mono text-sm">{step.completions.toLocaleString()}</TableCell>
      <TableCell className="text-right">
        <span className={`font-mono text-sm ${isLowConv ? "text-destructive" : ""}`}>
          {step.conversionFromPrev.toFixed(1)}%
        </span>
      </TableCell>
      <TableCell className="text-right">
        <span className="font-mono text-sm text-muted-foreground">{step.conversionFromInitial.toFixed(1)}%</span>
      </TableCell>
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
          {event.selectedValue || "—"}
        </TableCell>
        <TableCell className="text-xs">{event.deviceType || "—"}</TableCell>
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
              <DetailField label="Selected Value" value={event.selectedValue || "—"} />
              <DetailField label="Time on Step" value={event.timeOnStep !== null ? `${event.timeOnStep}s` : "—"} />
              <DetailField label="Device" value={event.deviceType || "—"} />
              <DetailField label="UTM Source" value={event.utmSource || "—"} />
              <DetailField label="UTM Campaign" value={event.utmCampaign || "—"} />
              <DetailField label="UTM Medium" value={event.utmMedium || "—"} />
              <DetailField label="UTM Content" value={event.utmContent || "—"} />
              <DetailField label="Referrer" value={event.referrer || "—"} />
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
  const [groupBy, setGroupBy] = useState("domain");

  const query = buildReportQuery(dateRange, groupBy);

  const drilldownQuery = useQuery<DrilldownResult>({
    queryKey: ["/api/analytics/drilldown", query],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/drilldown?${query}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drilldown");
      return res.json();
    },
    enabled: !authLoading,
  });

  useEffect(() => {
    if (drilldownQuery.error && isUnauthorizedError(drilldownQuery.error as Error)) {
      toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [drilldownQuery.error]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
          <BarChart3 className="w-6 h-6" />
          Drill-Down Reports
        </h1>
        <p className="text-sm text-muted-foreground">Detailed conversion analysis by dimension</p>
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

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Group by:</span>
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="w-[160px]" data-testid="select-group-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-group-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <DrilldownSummaryTable data={drilldownQuery.data} isLoading={drilldownQuery.isLoading} />

      <EventLogsSection dateRange={dateRange} />
    </div>
  );
}
