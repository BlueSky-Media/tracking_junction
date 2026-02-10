import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ReferrerRow {
  referrer: string;
  sessions: number;
  completions: number;
  conversionRate: number;
}

interface ReferrerBreakdownProps {
  data: ReferrerRow[] | undefined;
  isLoading: boolean;
}

export function ReferrerBreakdown({ data, isLoading }: ReferrerBreakdownProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-44 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-2" />
        ))}
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Top Referrers</h3>
        <div className="py-12 text-center text-muted-foreground">
          No referrer data available for the selected filters.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4" data-testid="text-referrer-title">Top Referrers</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Referrer</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Completions</TableHead>
              <TableHead className="text-right">Conv. Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index} data-testid={`row-referrer-${index}`}>
                <TableCell className="font-medium">
                  {row.referrer || <span className="text-muted-foreground">(direct)</span>}
                </TableCell>
                <TableCell className="text-right font-mono">{row.sessions.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono">{row.completions.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {row.conversionRate.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
