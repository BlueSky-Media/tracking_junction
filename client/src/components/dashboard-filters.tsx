import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

export interface Filters {
  page: string;
  pageType: string;
  domain: string;
  dateRange: DateRange | undefined;
}

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function DashboardFilters({ filters, onFiltersChange }: DashboardFiltersProps) {
  const update = (partial: Partial<Filters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const resetFilters = () => {
    onFiltersChange({
      page: "all",
      pageType: "all",
      domain: "all",
      dateRange: undefined,
    });
  };

  const hasActiveFilters = filters.page !== "all" || filters.pageType !== "all" || filters.domain !== "all" || filters.dateRange !== undefined;

  return (
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

      {hasActiveFilters && (
        <Button variant="ghost" size="icon" onClick={resetFilters} data-testid="button-reset-filters">
          <RotateCcw className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
