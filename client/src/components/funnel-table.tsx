import { useState, Fragment } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, TrendingDown, TrendingUp, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface FunnelStep {
  stepNumber: number;
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeOnStep: number | null;
}

interface StepOption {
  value: string;
  count: number;
  percentage: number;
}

interface StepBreakdownData {
  stepNumber: number;
  stepName: string;
  totalResponses: number;
  options: StepOption[];
}

interface FunnelTableProps {
  data: FunnelStep[] | undefined;
  isLoading: boolean;
  breakdownData?: StepBreakdownData[] | undefined;
}

const BAR_COLORS = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

function formatTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "\u2014";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function FunnelTable({ data, isLoading, breakdownData }: FunnelTableProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggleStep = (stepNumber: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepNumber)) next.delete(stepNumber);
      else next.add(stepNumber);
      return next;
    });
  };

  const breakdownMap = new Map<number, StepBreakdownData>();
  if (breakdownData) {
    for (const item of breakdownData) {
      breakdownMap.set(item.stepNumber, item);
    }
  }

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-2" />
        ))}
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Step-by-Step Conversion</h3>
        <div className="py-12 text-center text-muted-foreground">
          No data available for the selected filters.
        </div>
      </Card>
    );
  }

  const maxVisitors = data[0]?.uniqueVisitors || 1;
  const avgTimes = data.map(s => s.avgTimeOnStep).filter((t): t is number => t !== null);
  const medianTime = avgTimes.length > 0 ? avgTimes.sort((a, b) => a - b)[Math.floor(avgTimes.length / 2)] : 0;

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4" data-testid="text-conversion-table-title">Step-by-Step Conversion</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Step</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Visitors</TableHead>
              <TableHead className="text-right">% of Total</TableHead>
              <TableHead className="text-right">Drop-off</TableHead>
              <TableHead className="text-right">Avg Time</TableHead>
              <TableHead className="w-[200px]">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((step, idx) => {
              const pctOfTotal = (step.uniqueVisitors / maxVisitors) * 100;
              const isLast = idx === data.length - 1;
              const isHighDropOff = step.dropOffRate > 30;
              const isSlowStep = step.avgTimeOnStep !== null && medianTime > 0 && step.avgTimeOnStep > medianTime * 1.5;
              const breakdown = breakdownMap.get(step.stepNumber);
              const hasBreakdown = breakdown && breakdown.options.length > 0;
              const isExpandable = breakdownData !== undefined;
              const isExpanded = expandedSteps.has(step.stepNumber);

              return (
                <Fragment key={`${step.stepNumber}-${step.stepName}`}>
                  <TableRow
                    className={isExpandable ? "cursor-pointer hover-elevate" : ""}
                    data-testid={`row-step-${step.stepNumber}-${step.stepName}`}
                    onClick={() => isExpandable && toggleStep(step.stepNumber)}
                  >
                    <TableCell className="font-mono text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        {isExpandable && (
                          isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        {step.stepNumber}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {step.stepName}
                        {hasBreakdown && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {breakdown.options.length} responses
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{step.uniqueVisitors.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-mono">{pctOfTotal.toFixed(1)}%</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {idx === 0 ? (
                        <span className="text-muted-foreground">{"\u2014"}</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {isHighDropOff ? (
                            <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                          <Badge variant={isHighDropOff ? "destructive" : "secondary"} className="font-mono text-xs">
                            {step.dropOffRate.toFixed(1)}%
                          </Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isSlowStep && <Clock className="w-3.5 h-3.5 text-amber-500" />}
                        <span className={`font-mono text-sm ${isSlowStep ? "text-amber-500 font-semibold" : "text-muted-foreground"}`} data-testid={`text-time-step-${step.stepNumber}-${step.stepName}`}>
                          {formatTime(step.avgTimeOnStep)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${pctOfTotal}%` }}
                          />
                        </div>
                        {isLast && (
                          <TrendingUp className="w-3.5 h-3.5 text-chart-3" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow className="bg-muted/10" data-testid={`row-step-responses-${step.stepNumber}`}>
                      <TableCell colSpan={7} className="px-6 py-3">
                        {hasBreakdown ? (
                          <div className="space-y-2">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              Responses ({breakdown.totalResponses.toLocaleString()} total)
                            </div>
                            {breakdown.options.map((option, optIdx) => (
                              <div key={option.value} className="flex items-center gap-3" data-testid={`response-option-${step.stepNumber}-${optIdx}`}>
                                <span className="text-sm min-w-[120px] truncate">{option.value}</span>
                                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${BAR_COLORS[optIdx % BAR_COLORS.length]}`}
                                    style={{ width: `${option.percentage}%` }}
                                  />
                                </div>
                                <span className="text-sm font-mono text-muted-foreground min-w-[32px] text-right">{option.count}</span>
                                <Badge variant="outline" className="font-mono text-xs min-w-[48px] justify-center">
                                  {option.percentage.toFixed(1)}%
                                </Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground py-1">
                            No response data available for this step.
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
