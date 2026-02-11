import { useState, useCallback, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RequestLog {
  id: number;
  method: string;
  path: string;
  statusCode: number;
  requestBody: any;
  responseBody: any;
  ipAddress: string | null;
  userAgent: string | null;
  origin: string | null;
  contentType: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  eventType: string | null;
  domain: string | null;
  sessionId: string | null;
  createdAt: string;
}

interface LogsResponse {
  logs: RequestLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function StatusBadge({ status }: { status: number }) {
  if (status >= 200 && status < 300) {
    return <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"><CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />{status}</Badge>;
  }
  if (status >= 400 && status < 500) {
    return <Badge variant="outline" className="text-[9px] px-1 py-0 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30"><AlertCircle className="w-2.5 h-2.5 mr-0.5" />{status}</Badge>;
  }
  return <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"><XCircle className="w-2.5 h-2.5 mr-0.5" />{status}</Badge>;
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    GET: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    DELETE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
    PUT: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30",
  };
  return <Badge variant="outline" className={`text-[9px] px-1 py-0 font-mono ${colors[method] || ""}`}>{method}</Badge>;
}

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function JsonBlock({ data, label }: { data: any; label: string }) {
  if (!data) return <div className="text-[10px] text-muted-foreground italic">No {label.toLowerCase()}</div>;
  return (
    <div>
      <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <pre className="text-[10px] leading-tight bg-muted/50 dark:bg-muted/30 rounded-md p-2 overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
        {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function LogDetailPanel({ log }: { log: RequestLog }) {
  return (
    <div className="border-t bg-muted/20 dark:bg-muted/10">
      <Tabs defaultValue="request" className="w-full">
        <TabsList className="h-7 rounded-none border-b bg-transparent px-2 gap-1">
          <TabsTrigger value="request" className="text-[10px] h-5 px-2 data-[state=active]:bg-background rounded-md" data-testid="tab-request">Request</TabsTrigger>
          <TabsTrigger value="response" className="text-[10px] h-5 px-2 data-[state=active]:bg-background rounded-md" data-testid="tab-response">Response</TabsTrigger>
          <TabsTrigger value="headers" className="text-[10px] h-5 px-2 data-[state=active]:bg-background rounded-md" data-testid="tab-headers">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="request" className="p-2 mt-0">
          <JsonBlock data={log.requestBody} label="Request Body" />
        </TabsContent>
        <TabsContent value="response" className="p-2 mt-0">
          <JsonBlock data={log.responseBody} label="Response Body" />
          {log.errorMessage && (
            <div className="mt-2">
              <div className="text-[9px] font-semibold text-red-500 uppercase tracking-wider mb-1">Error</div>
              <div className="text-[10px] text-red-500 dark:text-red-400 bg-red-500/5 rounded-md p-2 font-mono break-all">
                {log.errorMessage}
              </div>
            </div>
          )}
        </TabsContent>
        <TabsContent value="headers" className="p-2 mt-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
            <DetailRow label="IP Address" value={log.ipAddress} />
            <DetailRow label="Origin" value={log.origin} />
            <DetailRow label="Content-Type" value={log.contentType} />
            <DetailRow label="Duration" value={log.durationMs != null ? `${log.durationMs}ms` : null} />
            <DetailRow label="Event Type" value={log.eventType} />
            <DetailRow label="Domain" value={log.domain} />
            <DetailRow label="Session ID" value={log.sessionId} />
            <div className="col-span-2">
              <DetailRow label="User Agent" value={log.userAgent} />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-1">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-mono truncate">{value || <span className="italic text-muted-foreground">-</span>}</span>
    </div>
  );
}

export default function ServerLogsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState<number>(0);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "50");
    if (search) params.set("search", search);
    if (statusFilter !== "all") params.set("statusCode", statusFilter);
    if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
    if (domainFilter !== "all") params.set("domain", domainFilter);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [page, search, statusFilter, eventTypeFilter, domainFilter, startDate, endDate]);

  const { data, isLoading, refetch } = useQuery<LogsResponse>({
    queryKey: ["/api/server-logs", page, search, statusFilter, eventTypeFilter, domainFilter, startDate, endDate],
    queryFn: async () => {
      const res = await fetch(`/api/server-logs?${buildParams()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: autoRefresh > 0 ? autoRefresh * 1000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/server-logs");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/server-logs"] });
      toast({ title: "Logs cleared" });
    },
    onError: () => {
      toast({ title: "Failed to delete logs", variant: "destructive" });
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const successCount = logs.filter(l => l.statusCode >= 200 && l.statusCode < 300).length;
  const errorCount = logs.filter(l => l.statusCode >= 400).length;

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-bold" data-testid="text-server-logs-title">Server Logs</h1>
          <Badge variant="secondary" className="text-[9px]">{total} total</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Select value={String(autoRefresh)} onValueChange={(v) => setAutoRefresh(Number(v))}>
            <SelectTrigger className="h-7 text-[10px] w-[100px]" data-testid="select-auto-refresh">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Off</SelectItem>
              <SelectItem value="10">10s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">1m</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="ghost" onClick={() => refetch()} data-testid="button-refresh-logs">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive" data-testid="button-clear-logs">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all server logs?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete all request log entries. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid="button-confirm-clear">Clear All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1); }}
            className="h-7 text-[10px] w-[120px]"
            data-testid="input-start-date"
          />
          <span className="text-[10px] text-muted-foreground">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1); }}
            className="h-7 text-[10px] w-[120px]"
            data-testid="input-end-date"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="h-7 text-[10px] w-[90px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="200">200 OK</SelectItem>
            <SelectItem value="400">400 Bad</SelectItem>
            <SelectItem value="500">500 Error</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventTypeFilter} onValueChange={(v) => { setEventTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="h-7 text-[10px] w-[110px]" data-testid="select-event-type-filter">
            <SelectValue placeholder="Event Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="page_land">page_land</SelectItem>
            <SelectItem value="step_complete">step_complete</SelectItem>
            <SelectItem value="form_complete">form_complete</SelectItem>
          </SelectContent>
        </Select>
        <Select value={domainFilter} onValueChange={(v) => { setDomainFilter(v); setPage(1); }}>
          <SelectTrigger className="h-7 text-[10px] w-[120px]" data-testid="select-domain-filter">
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            <SelectItem value="blueskylife.net">.net</SelectItem>
            <SelectItem value="blueskylife.io">.io</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 flex-1 min-w-[180px]">
          <Input
            placeholder="Search IP, session, origin..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="h-7 text-[10px]"
            data-testid="input-search-logs"
          />
          <Button size="sm" variant="ghost" onClick={handleSearch} data-testid="button-search-logs">
            <Search className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" /> {successCount} OK</span>
        <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" /> {errorCount} Errors</span>
        {autoRefresh > 0 && <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Auto {autoRefresh}s</span>}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]" data-testid="table-server-logs">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-6 px-1 py-1.5"></th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Event</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Domain</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Session</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">IP</th>
                  <th className="px-1.5 py-1.5 text-left font-medium text-muted-foreground">Origin</th>
                  <th className="px-1.5 py-1.5 text-right font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
                )}
                {!isLoading && logs.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No request logs found</td></tr>
                )}
                {logs.map(log => {
                  const expanded = expandedRows.has(log.id);
                  return (
                    <Fragment key={log.id}>
                      <tr
                        className={`border-b cursor-pointer transition-colors ${expanded ? "bg-muted/20" : ""} ${log.statusCode >= 400 ? "bg-red-500/[0.03]" : ""}`}
                        onClick={() => toggleRow(log.id)}
                        data-testid={`row-log-${log.id}`}
                      >
                        <td className="px-1 py-1">
                          {expanded
                            ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                        </td>
                        <td className="px-1.5 py-1 font-mono text-muted-foreground whitespace-nowrap">{formatTimestamp(log.createdAt)}</td>
                        <td className="px-1.5 py-1"><MethodBadge method={log.method} /></td>
                        <td className="px-1.5 py-1"><StatusBadge status={log.statusCode} /></td>
                        <td className="px-1.5 py-1 font-mono">{log.eventType || "-"}</td>
                        <td className="px-1.5 py-1 font-mono text-muted-foreground">{log.domain || "-"}</td>
                        <td className="px-1.5 py-1 font-mono text-muted-foreground truncate max-w-[100px]">{log.sessionId ? log.sessionId.substring(0, 8) + "..." : "-"}</td>
                        <td className="px-1.5 py-1 font-mono text-muted-foreground">{log.ipAddress || "-"}</td>
                        <td className="px-1.5 py-1 font-mono text-muted-foreground truncate max-w-[120px]">{log.origin || "-"}</td>
                        <td className="px-1.5 py-1 text-right font-mono">
                          {log.durationMs != null ? (
                            <span className={log.durationMs > 1000 ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground"}>
                              {log.durationMs}ms
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <LogDetailPanel log={log} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Page {page} of {totalPages} ({total} records)</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
