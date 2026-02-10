import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  sessions: number;
  conversions: number;
  conversionRate: number;
}

interface TimeHeatmapProps {
  data: HeatmapCell[] | undefined;
  isLoading: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function TimeHeatmap({ data, isLoading }: TimeHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-52 mb-1" />
        <Skeleton className="h-4 w-72 mb-6" />
        <Skeleton className="h-[220px] w-full" />
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-1">Activity Heatmap</h3>
        <p className="text-sm text-muted-foreground mb-6">Sessions by day and hour</p>
        <div className="h-[220px] flex items-center justify-center text-muted-foreground">
          No heatmap data available for the selected filters.
        </div>
      </Card>
    );
  }

  const maxSessions = Math.max(...data.map((c) => c.sessions), 1);

  const grid: Record<string, HeatmapCell> = {};
  for (const cell of data) {
    grid[`${cell.dayOfWeek}-${cell.hour}`] = cell;
  }

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-1" data-testid="text-heatmap-title">Activity Heatmap</h3>
      <p className="text-sm text-muted-foreground mb-4">Sessions by day and hour</p>
      <div className="relative overflow-x-auto">
        <div className="min-w-[600px]">
          <div className="flex">
            <div className="w-10 shrink-0" />
            <div className="flex-1 flex">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground font-mono pb-1">
                  {h}
                </div>
              ))}
            </div>
          </div>
          {DAY_LABELS.map((day, dayIdx) => (
            <div key={day} className="flex items-center">
              <div className="w-10 shrink-0 text-xs text-muted-foreground pr-2 text-right">{day}</div>
              <div className="flex-1 flex gap-px">
                {Array.from({ length: 24 }).map((_, h) => {
                  const cell = grid[`${dayIdx}-${h}`];
                  const sessions = cell?.sessions || 0;
                  const intensity = sessions / maxSessions;

                  return (
                    <div
                      key={h}
                      className="flex-1 aspect-square rounded-sm cursor-default transition-opacity"
                      style={{
                        backgroundColor: `hsl(var(--primary) / ${Math.max(intensity * 0.9, 0.05)})`,
                      }}
                      onMouseEnter={(e) => {
                        if (cell) {
                          setHoveredCell(cell);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const parentRect = e.currentTarget.closest(".relative")?.getBoundingClientRect();
                          if (parentRect) {
                            setTooltipPos({
                              x: rect.left - parentRect.left + rect.width / 2,
                              y: rect.top - parentRect.top - 4,
                            });
                          }
                        }
                      }}
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {hoveredCell && (
          <div
            className="absolute z-50 bg-popover border rounded-md p-2 shadow-lg text-xs pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-semibold">
              {DAY_LABELS[hoveredCell.dayOfWeek]} {hoveredCell.hour}:00
            </p>
            <p className="text-muted-foreground font-mono">{hoveredCell.sessions.toLocaleString()} sessions</p>
            <p className="text-muted-foreground font-mono">{hoveredCell.conversionRate.toFixed(1)}% conv.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
