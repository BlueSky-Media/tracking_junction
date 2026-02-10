import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, Smartphone, Tablet } from "lucide-react";

interface DeviceRow {
  deviceType: string;
  sessions: number;
  completions: number;
  conversionRate: number;
}

interface DeviceBreakdownProps {
  data: DeviceRow[] | undefined;
  isLoading: boolean;
}

function getDeviceIcon(deviceType: string) {
  const type = deviceType.toLowerCase();
  if (type === "mobile") return Smartphone;
  if (type === "tablet") return Tablet;
  return Monitor;
}

export function DeviceBreakdown({ data, isLoading }: DeviceBreakdownProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-44 mb-4" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full mb-3" />
        ))}
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="p-5">
        <h3 className="font-semibold mb-4">Device Breakdown</h3>
        <div className="py-12 text-center text-muted-foreground">
          No device data available for the selected filters.
        </div>
      </Card>
    );
  }

  const totalSessions = data.reduce((sum, d) => sum + d.sessions, 0) || 1;

  return (
    <Card className="p-5">
      <h3 className="font-semibold mb-4" data-testid="text-device-title">Device Breakdown</h3>
      <div className="space-y-4">
        {data.map((device, index) => {
          const Icon = getDeviceIcon(device.deviceType);
          const pct = (device.sessions / totalSessions) * 100;

          return (
            <div key={device.deviceType} data-testid={`device-row-${index}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium capitalize">{device.deviceType}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {device.sessions.toLocaleString()} sessions
                  </span>
                  <Badge variant="outline" className="font-mono text-xs">
                    {device.conversionRate.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 mt-1">
                <span className="text-xs text-muted-foreground font-mono">{pct.toFixed(1)}% of traffic</span>
                <span className="text-xs text-muted-foreground font-mono">{device.completions.toLocaleString()} completions</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
