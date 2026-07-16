import type { PaceStatus } from "./budgets";
import { formatMonthKey, shiftMonthKey } from "./budgets";
import type { FinancialYearPreference } from "./settingsStorage";

// A financial year "YYYY" label denotes the year it *ends* in — FY2026 runs
// Jul 2025 - Jun 2026. Every function below defaults to "calendar" so every
// existing call site (before AnnualBudgetManager/period.ts are updated to
// pass the real preference) keeps behaving exactly as it does today.

export function getCurrentYearKey(
  now: Date = new Date(),
  fyPreference: FinancialYearPreference = "calendar"
): string {
  if (fyPreference === "calendar") return String(now.getFullYear());
  // Jul (month index 6) onward already belongs to next year's FY label.
  return String(now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear());
}

// Adds `delta` years to a "YYYY" key — negative to go back. Pure integer
// arithmetic on the label, identical under either calendar or financial
// year mode, so this needs no fyPreference parameter at all.
export function shiftYearKey(year: string, delta: number): string {
  return String(Number(year) + delta);
}

export function getYearRange(
  year: string,
  fyPreference: FinancialYearPreference = "calendar"
): { from: string; to: string } {
  if (fyPreference === "calendar") return { from: `${year}-01-01`, to: `${year}-12-31` };
  const priorYear = Number(year) - 1;
  return { from: `${priorYear}-07-01`, to: `${year}-06-30` };
}

// Every "YYYY-MM" key in the year, in calendar order from the year's start
// month — used to build a full 12-point sparkline regardless of how much of
// the year has elapsed.
export function monthsInYear(
  year: string,
  fyPreference: FinancialYearPreference = "calendar"
): string[] {
  const startMonth = getYearRange(year, fyPreference).from.slice(0, 7);
  return Array.from({ length: 12 }, (_, i) => shiftMonthKey(startMonth, i));
}

// How many months of `year` have actually happened as of `now`: all 12 for a
// past year, 0 for a future year, and the count of the year's own months
// that are `now`'s month or earlier for the year currently in progress (so
// July counts as 7 elapsed months of calendar 2026, or 1 elapsed month of
// FY2027).
export function monthsElapsedInYear(
  year: string,
  now: Date = new Date(),
  fyPreference: FinancialYearPreference = "calendar"
): number {
  const currentYearKey = getCurrentYearKey(now, fyPreference);
  const targetNum = Number(year);
  const currentNum = Number(currentYearKey);
  if (targetNum < currentNum) return 12;
  if (targetNum > currentNum) return 0;

  const currentMonthKey = formatMonthKey(now);
  return monthsInYear(year, fyPreference).filter((m) => m <= currentMonthKey).length;
}

// Projects year-end spend from the pace so far — (spent / months elapsed) *
// 12 — the annual analogue of calculatePace's day-based projection. Returns
// the actual total once the year is over (no more pace left to project).
export function projectedYearEndSpend(
  spentYTD: number,
  year: string,
  now: Date = new Date(),
  fyPreference: FinancialYearPreference = "calendar"
): number {
  const elapsed = monthsElapsedInYear(year, now, fyPreference);
  if (elapsed <= 0) return 0;
  if (elapsed >= 12) return spentYTD;
  return (spentYTD / elapsed) * 12;
}

// Only meaningful for the year currently in progress — a past year's pace is
// moot (it already happened), a future year has no spend yet.
export function calculateAnnualPace(
  spentYTD: number,
  budgetAmount: number,
  year: string,
  now: Date = new Date(),
  fyPreference: FinancialYearPreference = "calendar"
): PaceStatus | null {
  if (budgetAmount <= 0) return null;
  if (getCurrentYearKey(now, fyPreference) !== year) return null;

  const elapsed = monthsElapsedInYear(year, now, fyPreference);
  if (elapsed <= 0) return null;

  const projected = projectedYearEndSpend(spentYTD, year, now, fyPreference);
  return projected > budgetAmount ? "atRisk" : "onTrack";
}

// Display label for a year key — "2026" under calendar mode, "FY2026" under
// financial mode (Jul 2025 - Jun 2026).
export function formatYearLabel(year: string, fyPreference: FinancialYearPreference = "calendar"): string {
  return fyPreference === "financial" ? `FY${year}` : year;
}

// Resolves an arbitrary "YYYY-MM" month (not just "now") to the year label
// that covers it — calendar mode is a plain slice; financial mode applies
// the same Jul-threshold as getCurrentYearKey, but to the given month rather
// than the current date.
export function getYearKeyForMonth(
  monthKey: string,
  fyPreference: FinancialYearPreference = "calendar"
): string {
  const [year, month] = monthKey.split("-").map(Number);
  if (fyPreference === "calendar") return String(year);
  return String(month >= 7 ? year + 1 : year);
}
