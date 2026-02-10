import { Card } from "@/components/ui/card";
import { Users, MousePointerClick, TrendingUp, Percent, ArrowDownRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsData {
  totalSessions: number;
  totalEvents: number;
  overallConversion: number;
  avgStepsCompleted: number;
  bounceRate: number;
}

interface StatsCardsProps {
  data: StatsData | undefined;
  isLoading: boolean;
}

const stats = [
  {
    key: "totalSessions" as const,
    label: "Total Visitors",
    icon: Users,
    format: (v: number) => v.toLocaleString(),
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
  },
  {
    key: "totalEvents" as const,
    label: "Total Events",
    icon: MousePointerClick,
    format: (v: number) => v.toLocaleString(),
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
  },
  {
    key: "overallConversion" as const,
    label: "Completion Rate",
    icon: Percent,
    format: (v: number) => `${v.toFixed(1)}%`,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
  {
    key: "bounceRate" as const,
    label: "Bounce Rate",
    icon: ArrowDownRight,
    format: (v: number) => `${v.toFixed(1)}%`,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
  },
  {
    key: "avgStepsCompleted" as const,
    label: "Avg Steps",
    icon: TrendingUp,
    format: (v: number) => v.toFixed(1),
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
  },
];

export function StatsCards({ data, isLoading }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {stats.map((stat) => (
        <Card key={stat.key} className="p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <span className="text-sm text-muted-foreground">{stat.label}</span>
            <div className={`w-9 h-9 rounded-md ${stat.bgColor} flex items-center justify-center`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <span className="text-2xl font-bold" data-testid={`text-stat-${stat.key}`}>
              {data ? stat.format(data[stat.key]) : "\u2014"}
            </span>
          )}
        </Card>
      ))}
    </div>
  );
}
