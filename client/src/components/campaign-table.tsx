import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CampaignRow {
  campaign: string;
  source: string;
  medium: string;
  sessions: number;
  completions: number;
  conversionRate: number;
}

interface CampaignTableProps {
  data: CampaignRow[] | undefined;
  isLoading: boolean;
}

function CellValue({ value }: { value: string }) {
  if (value === "(none)") {
    return <span className="text-muted-foreground">{value}</span>;
  }
  return <span>{value}</span>;
}

export function CampaignTable({ data, isLoading }: CampaignTableProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-48 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full mb-2" />
        ))}
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Campaign Performance</h3>
        <div className="py-12 text-center text-muted-foreground">
          No campaign data available for the selected filters.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4" data-testid="text-campaign-title">Campaign Performance</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Medium</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Completions</TableHead>
              <TableHead className="text-right">Conv. Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index} data-testid={`row-campaign-${index}`}>
                <TableCell className="font-medium">
                  <CellValue value={row.campaign} />
                </TableCell>
                <TableCell>
                  <CellValue value={row.source} />
                </TableCell>
                <TableCell>
                  <CellValue value={row.medium} />
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
