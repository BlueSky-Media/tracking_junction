import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunnelStep {
  stepNumber: number;
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
}

interface FunnelChartProps {
  data: FunnelStep[] | undefined;
  isLoading: boolean;
}

export function FunnelChart({ data, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-40 mb-1" />
        <Skeleton className="h-4 w-60 mb-6" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Funnel Overview</h3>
        <p className="text-sm text-muted-foreground mb-6">Visitor drop-off between steps</p>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          No funnel data available for the selected filters.
        </div>
      </Card>
    );
  }

  const maxVisitors = data[0]?.uniqueVisitors || 1;

  const chartData = data.map((step) => ({
    name: step.stepName,
    visitors: step.uniqueVisitors,
    pct: ((step.uniqueVisitors / maxVisitors) * 100).toFixed(1),
    dropOff: step.dropOffRate.toFixed(1),
    conversion: step.conversionRate.toFixed(1),
  }));

  const colors = [
    "hsl(210, 85%, 35%)",
    "hsl(210, 80%, 40%)",
    "hsl(210, 75%, 45%)",
    "hsl(210, 70%, 50%)",
    "hsl(210, 65%, 55%)",
    "hsl(210, 60%, 58%)",
    "hsl(210, 55%, 62%)",
    "hsl(210, 50%, 66%)",
    "hsl(210, 45%, 70%)",
  ];

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-1" data-testid="text-funnel-title">Funnel Overview</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Unique visitors at each step — {data[0]?.uniqueVisitors.toLocaleString()} started, {data[data.length - 1]?.uniqueVisitors.toLocaleString()} completed
      </p>
      <div className="h-[300px]" data-testid="chart-funnel">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={50}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover border border-popover-border rounded-md p-3 shadow-lg text-sm">
                    <p className="font-semibold mb-1">{d.name}</p>
                    <p className="text-muted-foreground">{d.visitors.toLocaleString()} visitors ({d.pct}%)</p>
                    <p className="text-muted-foreground">Drop-off: {d.dropOff}%</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="visitors" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {chartData.map((_, index) => (
                <Cell key={index} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
