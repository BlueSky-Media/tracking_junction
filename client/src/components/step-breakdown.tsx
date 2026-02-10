import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

interface StepBreakdownProps {
  data: StepBreakdownData[] | undefined;
  isLoading: boolean;
}

const barColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
];

export function StepBreakdown({ data, isLoading }: StepBreakdownProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-52 mb-1" />
        <Skeleton className="h-4 w-72 mb-6" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full mb-3" />
        ))}
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Option Breakdowns</h3>
        <p className="text-sm text-muted-foreground mb-6">What visitors selected at each step</p>
        <div className="py-12 text-center text-muted-foreground">
          No breakdown data available for the selected filters.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-1" data-testid="text-breakdown-title">Option Breakdowns</h3>
      <p className="text-sm text-muted-foreground mb-4">What visitors selected at each step</p>
      <Accordion type="multiple" className="w-full">
        {data.map((step) => (
          <AccordionItem key={step.stepNumber} value={`step-${step.stepNumber}`} data-testid={`accordion-step-${step.stepNumber}`}>
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left">
                <Badge variant="secondary" className="font-mono text-xs">
                  {step.stepNumber}
                </Badge>
                <span className="font-medium">{step.stepName}</span>
                <span className="text-sm text-muted-foreground">
                  {step.totalResponses.toLocaleString()} responses
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4">
              <div className="space-y-2.5 pt-1">
                {step.options.map((option, idx) => (
                  <div key={option.value} className="group" data-testid={`option-${step.stepNumber}-${idx}`}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-sm truncate flex-1">{option.value}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground font-mono">{option.count.toLocaleString()}</span>
                        <Badge variant="outline" className="font-mono text-xs min-w-[52px] justify-center">
                          {option.percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColors[idx % barColors.length]}`}
                        style={{ width: `${option.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}
