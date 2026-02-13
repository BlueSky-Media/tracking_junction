import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const TIMEZONE_STORAGE_KEY = "tj_timezone";

export const TIMEZONE_OPTIONS = [
  { value: "America/Puerto_Rico", label: "AST (Puerto Rico)", short: "AST" },
  { value: "America/New_York", label: "EST/EDT (Eastern)", short: "ET" },
  { value: "America/Chicago", label: "CST/CDT (Central)", short: "CT" },
  { value: "America/Denver", label: "MST/MDT (Mountain)", short: "MT" },
  { value: "America/Los_Angeles", label: "PST/PDT (Pacific)", short: "PT" },
  { value: "America/Anchorage", label: "AKST/AKDT (Alaska)", short: "AKT" },
  { value: "Pacific/Honolulu", label: "HST (Hawaii)", short: "HST" },
  { value: "UTC", label: "UTC", short: "UTC" },
];

interface TimezoneContextValue {
  timezone: string;
  setTimezone: (tz: string) => void;
  formatInTimezone: (date: Date) => string;
  nowInTimezone: () => string;
  getTimezoneShort: () => string;
}

const TimezoneContext = createContext<TimezoneContextValue | null>(null);

function getStoredTimezone(): string {
  try {
    const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (stored && TIMEZONE_OPTIONS.some(o => o.value === stored)) return stored;
  } catch {}
  return "America/New_York";
}

export function TimezoneProvider({ children }: { children: ReactNode }) {
  const [timezone, setTimezoneState] = useState<string>(getStoredTimezone);

  const setTimezone = useCallback((tz: string) => {
    setTimezoneState(tz);
    try { localStorage.setItem(TIMEZONE_STORAGE_KEY, tz); } catch {}
  }, []);

  const formatInTimezone = useCallback((date: Date) => {
    return date.toLocaleString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [timezone]);

  const nowInTimezone = useCallback(() => {
    return new Date().toLocaleString("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }, [timezone]);

  const getTimezoneShort = useCallback(() => {
    const opt = TIMEZONE_OPTIONS.find(o => o.value === timezone);
    return opt?.short || "UTC";
  }, [timezone]);

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, formatInTimezone, nowInTimezone, getTimezoneShort }}>
      {children}
    </TimezoneContext.Provider>
  );
}

export function useTimezone() {
  const ctx = useContext(TimezoneContext);
  if (!ctx) throw new Error("useTimezone must be used within TimezoneProvider");
  return ctx;
}
