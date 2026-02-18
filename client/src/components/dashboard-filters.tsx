import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

const FUNNEL_LABELS: Record<string, string> = {
  "lead-seniors-f3q8": "Seniors Lead-Gen",
  "lead-veterans-f3q8": "Veterans Lead-Gen",
  "lead-firstresponders-f3q8": "First Responders Lead-Gen",
  "quote-lead-seniors-fjk6": "Seniors Quote (w/ lead)",
  "quote-lead-veterans-fjk6": "Veterans Quote (w/ lead)",
  "quote-seniors-fjk6": "Seniors Quote (no lead)",
  "quote-veterans-fjk6": "Veterans Quote (no lead)",
};

function formatFunnelLabel(id: string): string {
  return FUNNEL_LABELS[id] || id;
}

export interface Filters {
  page: string;
  pageType: string;
  domain: string;
  funnelId: string;
  dateRange: DateRange | undefined;
  utmSource: string;
  utmCampaign: string;
  utmMedium: string;
  deviceType: string;
}

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = (partial: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const resetFilters = () => {
    onFiltersChange({
      page: "all",
      pageType: "all",
      domain: "all",
      funnelId: "all",
      dateRange: undefined,
      utmSource: "all",
      utmCampaign: "all",
      utmMedium: "all",
      deviceType: "all",
    });
  };

  const filterOptionsQuery = useQuery({
    queryKey: ["/api/analytics/filter-options"],
  });

  const options = filterOptionsQuery.data as { utmSources: string[]; utmCampaigns: string[]; utmMediums: string[]; funnelIds: string[] } | undefined;

  const hasActiveFilters =
    filters.page !== "all" || filters.pageType !== "all" || filters.domain !== "all" ||
    filters.funnelId !== "all" || filters.dateRange !== undefined || filters.utmSource !== "all" ||
    filters.utmCampaign !== "all" || filters.utmMedium !== "all" || filters.deviceType !== "all";

  const hasAdvancedFilters =
    filters.utmSource !== "all" || filters.utmCampaign !== "all" ||
    filters.utmMedium !== "all" || filters.deviceType !== "all";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filters.page} onValueChange={(v) => update({ page: v })}>
          <SelectTrigger className="w-[160px]" data-testid="select-page">
            <SelectValue placeholder="Page Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pages</SelectItem>
            <SelectItem value="seniors">Seniors</SelectItem>
            <SelectItem value="veterans">Veterans</SelectItem>
            <SelectItem value="first-responders">First Responders</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.pageType} onValueChange={(v) => update({ pageType: v })}>
          <SelectTrigger className="w-[160px]" data-testid="select-funnel-type">
            <SelectValue placeholder="Funnel Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Funnels</SelectItem>
            <SelectItem value="lead">Lead Gen</SelectItem>
            <SelectItem value="call">Call-In</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.domain} onValueChange={(v) => update({ domain: v })}>
          <SelectTrigger className="w-[170px]" data-testid="select-domain">
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            <SelectItem value="blueskylife.net">blueskylife.net</SelectItem>
            <SelectItem value="blueskylife.io">blueskylife.io</SelectItem>
          </SelectContent>
        </Select>

        {options?.funnelIds && options.funnelIds.length > 0 && (
          <Select value={filters.funnelId} onValueChange={(v) => update({ funnelId: v })}>
            <SelectTrigger className="w-[200px]" data-testid="select-funnel-id">
              <SelectValue placeholder="Funnel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Funnels</SelectItem>
              {options.funnelIds.map((f) => (
                <SelectItem key={f} value={f}>{formatFunnelLabel(f)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[200px] justify-start text-left font-normal" data-testid="button-date-range">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, "MMM d")} - {format(filters.dateRange.to, "MMM d, yyyy")}
                  </>
                ) : (
                  format(filters.dateRange.from, "MMM d, yyyy")
                )
              ) : (
                <span className="text-muted-foreground">All Time</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={filters.dateRange}
              onSelect={(range) => update({ dateRange: range })}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          data-testid="button-toggle-advanced"
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          {hasAdvancedFilters ? "Campaign Filters (active)" : "Campaign Filters"}
        </Button>

        {hasActiveFilters && (
          <Button variant="ghost" size="icon" onClick={resetFilters} data-testid="button-reset-filters">
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>

      {showAdvanced && (
        <div className="flex items-center gap-3 flex-wrap pl-0">
          <Select value={filters.utmSource} onValueChange={(v) => update({ utmSource: v })}>
            <SelectTrigger className="w-[150px]" data-testid="select-utm-source">
              <SelectValue placeholder="UTM Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {options?.utmSources.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.utmCampaign} onValueChange={(v) => update({ utmCampaign: v })}>
            <SelectTrigger className="w-[180px]" data-testid="select-utm-campaign">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {options?.utmCampaigns.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.utmMedium} onValueChange={(v) => update({ utmMedium: v })}>
            <SelectTrigger className="w-[140px]" data-testid="select-utm-medium">
              <SelectValue placeholder="Medium" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Mediums</SelectItem>
              {options?.utmMediums.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.deviceType} onValueChange={(v) => update({ deviceType: v })}>
            <SelectTrigger className="w-[140px]" data-testid="select-device-type">
              <SelectValue placeholder="Device" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="tablet">Tablet</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
