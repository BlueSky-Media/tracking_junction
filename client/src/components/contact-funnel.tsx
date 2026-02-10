import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, TrendingDown } from "lucide-react";

interface FunnelStep {
  stepName: string;
  uniqueVisitors: number;
  conversionRate: number;
  dropOffRate: number;
}

interface ContactFunnelProps {
  data: { steps: FunnelStep[] } | undefined;
  isLoading: boolean;
}

export function ContactFunnel({ data, isLoading }: ContactFunnelProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-44 mb-4" />
        <div className="flex items-center gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 flex-1" />
          ))}
        </div>
      </Card>
    );
  }

  if (!data || !data.steps || data.steps.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Contact Funnel</h3>
        <div className="py-12 text-center text-muted-foreground">
          No contact funnel data available for the selected filters.
        </div>
      </Card>
    );
  }

  const maxVisitors = data.steps[0]?.uniqueVisitors || 1;

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4" data-testid="text-contact-funnel-title">Contact Funnel</h3>
      <div className="flex items-stretch gap-2 flex-wrap">
        {data.steps.map((step, idx) => {
          const pct = (step.uniqueVisitors / maxVisitors) * 100;
          const isLast = idx === data.steps.length - 1;

          return (
            <div key={step.stepName} className="flex items-center gap-2 flex-1 min-w-[120px]">
              <div className="flex-1">
                <div className="text-sm font-medium mb-1">{step.stepName}</div>
                <div className="text-xs text-muted-foreground font-mono mb-2">
                  {step.uniqueVisitors.toLocaleString()} visitors
                </div>
                <div className="h-8 rounded-md bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-md bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <Badge variant="outline" className="font-mono text-xs">
                    {step.conversionRate.toFixed(1)}%
                  </Badge>
                  {step.dropOffRate > 0 && (
                    <div className="flex items-center gap-1">
                      <TrendingDown className="w-3 h-3 text-destructive" />
                      <span className="text-xs text-destructive font-mono">-{step.dropOffRate.toFixed(1)}%</span>
                    </div>
                  )}
                </div>
              </div>
              {!isLast && (
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
