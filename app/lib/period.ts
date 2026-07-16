import { getCurrentYearKey, getYearRange, shiftYearKey } from "./annualBudgets";
import { settingsStore } from "./settingsStorage";
import type { FinancialYearPreference } from "./settingsStorage";

export type PeriodOption =
  | "thisMonth"
  | "lastMonth"
  | "last3Months"
  | "last6Months"
  | "thisYear"
  | "lastYear"
  | "custom";

export type PeriodState = {
  option: PeriodOption;
  customFrom: string;
  customTo: string;
};

export const DEFAULT_PERIOD: PeriodState = {
  option: "thisMonth",
  customFrom: "",
  customTo: "",
};

export const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: "thisMonth", label: "This Month" },
  { value: "lastMonth", label: "Last Month" },
  { value: "last3Months", label: "Last 3 Months" },
  { value: "last6Months", label: "Last 6 Months" },
  { value: "thisYear", label: "This Year" },
  { value: "lastYear", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

// Transaction dates are plain "YYYY-MM-DD" strings compared lexicographically
// throughout the app — format from local Y/M/D rather than toISOString(),
// which converts through UTC and can shift the date by a day.
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Returns an inclusive [from, to] ISO date range for the given period.
// "Last N Months" is a trailing window that includes the current month.
// For "custom", returns null until both endpoints are actually filled in —
// callers should treat that as "nothing selected yet" rather than "all time".
//
// `fyPreference` defaults to reading the settings store directly rather than
// being threaded through as a required prop — getPeriodRange has 7 call
// sites across the dashboard's charts, none of which have a settings context
// at hand, and only 2 of the 6 period options (thisYear/lastYear) actually
// need it. This mirrors chartLayoutStore's established precedent for a
// non-React module reading a persisted client preference; the trade-off is
// that this function's output becomes implicitly dependent on that global
// state for those two options, which is fine given the codebase has no unit
// tests today and every existing call site keeps working unchanged.
export function getPeriodRange(
  period: PeriodState,
  now: Date = new Date(),
  fyPreference: FinancialYearPreference = settingsStore.getSnapshot().financialYearPreference
): { from: string; to: string } | null {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period.option) {
    case "thisMonth":
      return {
        from: toISODate(new Date(year, month, 1)),
        to: toISODate(new Date(year, month + 1, 0)),
      };
    case "lastMonth":
      return {
        from: toISODate(new Date(year, month - 1, 1)),
        to: toISODate(new Date(year, month, 0)),
      };
    case "last3Months":
      return {
        from: toISODate(new Date(year, month - 2, 1)),
        to: toISODate(new Date(year, month + 1, 0)),
      };
    case "last6Months":
      return {
        from: toISODate(new Date(year, month - 5, 1)),
        to: toISODate(new Date(year, month + 1, 0)),
      };
    case "thisYear":
      return getYearRange(getCurrentYearKey(now, fyPreference), fyPreference);
    case "lastYear":
      return getYearRange(shiftYearKey(getCurrentYearKey(now, fyPreference), -1), fyPreference);
    case "custom":
      if (!period.customFrom || !period.customTo) return null;
      return { from: period.customFrom, to: period.customTo };
  }
}

export function filterTransactionsByPeriod<T extends { date: string }>(
  transactions: T[],
  period: PeriodState,
  now: Date = new Date()
): T[] {
  const range = getPeriodRange(period, now);
  if (!range) return [];
  return transactions.filter((t) => t.date >= range.from && t.date <= range.to);
}

// Formats a "YYYY-MM" month key (e.g. "2026-07") as "Jul 26" for chart axes.
export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

// Returns the full-month [from, to] range for a "YYYY-MM" key — used by
// chart drill-downs to turn "the bar for July 2026" into a concrete range.
export function getMonthRange(monthKey: string): { from: string; to: string } {
  const [year, month] = monthKey.split("-").map(Number);
  return {
    from: toISODate(new Date(year, month - 1, 1)),
    to: toISODate(new Date(year, month, 0)),
  };
}

// Human-readable label for a date range, used as a chart drill-down title —
// "June 2026" for a full calendar month, "July 15, 2026" for a single day,
// and a "Jun 1 – Aug 31, 2026" span otherwise.
export function formatPeriodLabel(range: { from: string; to: string }): string {
  const fromDate = parseISODate(range.from);
  const toDate = parseISODate(range.to);

  if (range.from === range.to) {
    return fromDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  const isFullMonth =
    fromDate.getDate() === 1 &&
    toDate.getFullYear() === fromDate.getFullYear() &&
    toDate.getMonth() === fromDate.getMonth() &&
    toDate.getDate() === new Date(fromDate.getFullYear(), fromDate.getMonth() + 1, 0).getDate();

  if (isFullMonth) {
    return fromDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const fromLabel = fromDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const toLabel = toDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fromLabel} – ${toLabel}`;
}
