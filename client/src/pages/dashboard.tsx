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
import { CsvExportButton } from "@/components/csv-export-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, FileText } from "lucide-react";
import { Link } from "wouter";
import logoImg from "@assets/TrackingJunctionLogo_1770758622147.png";
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
  const { user, isLoading: authLoading, logout } = useAuth();
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
    if (!authLoading && !user) {
      toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
      setTimeout(() => { window.location.href = "/api/login"; }, 500);
    }
  }, [user, authLoading]);

  useEffect(() => {
    const errors = [statsQuery.error, funnelQuery.error, breakdownQuery.error].filter(Boolean);
    errors.forEach((error) => {
      if (error && isUnauthorizedError(error as Error)) {
        toast({ title: "Unauthorized", description: "Logging in again...", variant: "destructive" });
        setTimeout(() => { window.location.href = "/api/login"; }, 500);
      }
    });
  }, [statsQuery.error, funnelQuery.error, breakdownQuery.error]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <img src={logoImg} alt="TrackingJunction" className="h-8 animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const initials = [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") || "U";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="TrackingJunction" className="h-7" data-testid="text-dashboard-logo" />
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs">
              <Button variant="ghost" size="icon" data-testid="button-api-docs">
                <FileText className="w-4 h-4" />
              </Button>
            </Link>
            <CsvExportButton query={query} />
            <ThemeToggle />
            <div className="flex items-center gap-2 pl-2 border-l">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.profileImageUrl || undefined} alt={user?.firstName || "User"} />
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:block" data-testid="text-user-name">
                {user?.firstName} {user?.lastName}
              </span>
              <Button variant="ghost" size="icon" onClick={() => logout()} data-testid="button-logout">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
      </main>
    </div>
  );
}
