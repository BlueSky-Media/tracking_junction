import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, TrendingDown, TrendingUp } from "lucide-react";

interface FunnelStep {
  stepNumber: number;
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
}

interface FunnelTableProps {
  data: FunnelStep[] | undefined;
  isLoading: boolean;
}

export function FunnelTable({ data, isLoading }: FunnelTableProps) {
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
              <TableHead className="w-[200px]">Progress</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((step, idx) => {
              const pctOfTotal = (step.uniqueVisitors / maxVisitors) * 100;
              const isLast = idx === data.length - 1;
              const isHighDropOff = step.dropOffRate > 30;

              return (
                <TableRow key={step.stepNumber} data-testid={`row-step-${step.stepNumber}`}>
                  <TableCell className="font-mono text-muted-foreground">{step.stepNumber}</TableCell>
                  <TableCell className="font-medium">{step.stepName}</TableCell>
                  <TableCell className="text-right font-mono">{step.uniqueVisitors.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono">{pctOfTotal.toFixed(1)}%</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {idx === 0 ? (
                      <span className="text-muted-foreground">—</span>
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
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
