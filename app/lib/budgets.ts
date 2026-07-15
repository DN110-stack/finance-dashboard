export type PaceStatus = "onTrack" | "atRisk";

export function formatMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function getCurrentMonthKey(now: Date = new Date()): string {
  return formatMonthKey(now);
}

// Adds `delta` months to a "YYYY-MM" key — negative to go back, e.g.
// shiftMonthKey("2026-01", -1) === "2025-12".
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  return formatMonthKey(new Date(year, month - 1 + delta, 1));
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

// Progress bar fill colour by percent-of-budget spent: green under 75%,
// amber 75-99%, red at/over 100%.
export function progressBarColour(percent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 75) return "bg-amber-500";
  return "bg-emerald-500";
}

// Projects month-end spend from the pace so far — (spent / days elapsed) *
// days in month — and compares it to the budget. Only meaningful for the
// current month (a past month's pace is moot, a future month has no spend
// yet), and only once a budget is actually set.
export function calculatePace(
  spent: number,
  budgetAmount: number,
  monthKey: string,
  now: Date = new Date()
): PaceStatus | null {
  if (budgetAmount <= 0) return null;
  if (getCurrentMonthKey(now) !== monthKey) return null;

  const totalDays = daysInMonth(monthKey);
  const daysElapsed = Math.min(now.getDate(), totalDays);
  if (daysElapsed <= 0) return null;

  const projected = (spent / daysElapsed) * totalDays;
  return projected > budgetAmount ? "atRisk" : "onTrack";
}
