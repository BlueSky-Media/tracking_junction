import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { StatsCards } from "@/components/stats-cards";
import { FunnelChart } from "@/components/funnel-chart";
import { FunnelTable } from "@/components/funnel-table";
import { StepBreakdown } from "@/components/step-breakdown";
import { DashboardFilters, type Filters } from "@/components/dashboard-filters";
import { CampaignTable } from "@/components/campaign-table";
import { DeviceBreakdown } from "@/components/device-breakdown";
import { TimeHeatmap } from "@/components/time-heatmap";
import { ContactFunnel } from "@/components/contact-funnel";
import { ReferrerBreakdown } from "@/components/referrer-breakdown";
import { isUnauthorizedError } from "@/lib/auth-utils";
import { format } from "date-fns";

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.page !== "all") params.set("page", filters.page);
  if (filters.pageType !== "all") params.set("pageType", filters.pageType);
  if (filters.domain !== "all") params.set("domain", filters.domain);
  if (filters.dateRange?.from) params.set("startDate", format(filters.dateRange.from, "yyyy-MM-dd"));
  if (filters.dateRange?.to) params.set("endDate", format(filters.dateRange.to, "yyyy-MM-dd"));
  if (filters.utmSource !== "all") params.set("utmSource", filters.utmSource);
  if (filters.utmCampaign !== "all") params.set("utmCampaign", filters.utmCampaign);
  if (filters.utmMedium !== "all") params.set("utmMedium", filters.utmMedium);
  if (filters.deviceType !== "all") params.set("deviceType", filters.deviceType);
  return params.toString();
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [filters, setFilters] = useState<Filters>({
    page: "all",
    pageType: "all",
    domain: "all",
    dateRange: undefined,
    utmSource: "all",
    utmCampaign: "all",
    utmMedium: "all",
    deviceType: "all",
  });

  const query = buildQuery(filters);

  const fetchWithQuery = async (base: string) => {
    const url = query ? `${base}?${query}` : base;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
    return res.json();
  };

  const statsQuery = useQuery({
    queryKey: ["/api/analytics/stats", query],
    queryFn: () => fetchWithQuery("/api/analytics/stats"),
    enabled: !authLoading,
  });

  const funnelQuery = useQuery({
    queryKey: ["/api/analytics/funnel", query],
    queryFn: () => fetchWithQuery("/api/analytics/funnel"),
    enabled: !authLoading,
  });

  const breakdownQuery = useQuery({
    queryKey: ["/api/analytics/breakdown", query],
    queryFn: () => fetchWithQuery("/api/analytics/breakdown"),
    enabled: !authLoading,
  });

  const campaignsQuery = useQuery({
    queryKey: ["/api/analytics/campaigns", query],
    queryFn: () => fetchWithQuery("/api/analytics/campaigns"),
    enabled: !authLoading,
  });

  const devicesQuery = useQuery({
    queryKey: ["/api/analytics/devices", query],
    queryFn: () => fetchWithQuery("/api/analytics/devices"),
    enabled: !authLoading,
  });

  const heatmapQuery = useQuery({
    queryKey: ["/api/analytics/heatmap", query],
    queryFn: () => fetchWithQuery("/api/analytics/heatmap"),
    enabled: !authLoading,
  });

  const contactFunnelQuery = useQuery({
    queryKey: ["/api/analytics/contact-funnel", query],
    queryFn: () => fetchWithQuery("/api/analytics/contact-funnel"),
    enabled: !authLoading,
  });

  const referrersQuery = useQuery({
    queryKey: ["/api/analytics/referrers", query],
    queryFn: () => fetchWithQuery("/api/analytics/referrers"),
    enabled: !authLoading,
  });

  useEffect(() => {
    const errors = [statsQuery.error, funnelQuery.error, breakdownQuery.error].filter(Boolean);
    errors.forEach((error) => {
      if (error && isUnauthorizedError(error as Error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
      }
    });
  }, [statsQuery.error, funnelQuery.error, breakdownQuery.error]);

  return (
    <div className="px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1" data-testid="text-dashboard-title">Analytics Dashboard</h1>
        <p className="text-sm text-muted-foreground">Track visitor behavior across your landing page funnels</p>
      </div>

      <DashboardFilters filters={filters} onFiltersChange={setFilters} />

      <StatsCards data={statsQuery.data as any} isLoading={statsQuery.isLoading} />

      <FunnelChart data={(funnelQuery.data as any)?.steps} isLoading={funnelQuery.isLoading} />

      <FunnelTable data={(funnelQuery.data as any)?.steps} isLoading={funnelQuery.isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContactFunnel data={contactFunnelQuery.data as any} isLoading={contactFunnelQuery.isLoading} />
        <DeviceBreakdown data={devicesQuery.data as any} isLoading={devicesQuery.isLoading} />
      </div>

      <CampaignTable data={campaignsQuery.data as any} isLoading={campaignsQuery.isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReferrerBreakdown data={referrersQuery.data as any} isLoading={referrersQuery.isLoading} />
        <TimeHeatmap data={heatmapQuery.data as any} isLoading={heatmapQuery.isLoading} />
      </div>

      <StepBreakdown data={breakdownQuery.data as any} isLoading={breakdownQuery.isLoading} />
    </div>
  );
}
