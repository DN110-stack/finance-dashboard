import { toISODate } from "./period";
import { getCurrentMonthKey, shiftMonthKey } from "./budgets";

export type PeriodType = "weekly" | "monthly" | "bi-monthly" | "quarterly" | "bi-annual" | "annual";

// Offered by the Add Budget period-type picker — deliberately excludes
// "annual": the separate Annual Budget tab already owns that. "annual"
// still exists as a valid DB-level value (see the phase_k migration) so
// nothing needs to change at the schema layer if that ever revisits.
export const ADD_BUDGET_PERIOD_TYPES: PeriodType[] = [
  "weekly",
  "monthly",
  "bi-monthly",
  "quarterly",
  "bi-annual",
];

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  "bi-monthly": "Bi-monthly (every 2 months)",
  quarterly: "Quarterly (every 3 months)",
  "bi-annual": "Bi-annual (every 6 months)",
  annual: "Annual",
};

// Singular noun for "Amount per ___" / "Applies every ___" copy.
export const PERIOD_NOUN: Record<PeriodType, string> = {
  weekly: "week",
  monthly: "month",
  "bi-monthly": "2 months",
  quarterly: "quarter",
  "bi-annual": "6 months",
  annual: "year",
};

// Month-recurrence interval — absent for weekly, which isn't month-cyclic.
const PERIOD_MONTH_INTERVAL: Partial<Record<PeriodType, number>> = {
  monthly: 1,
  "bi-monthly": 2,
  quarterly: 3,
  "bi-annual": 6,
  annual: 12,
};

const AVG_WEEKS_PER_MONTH = 52 / 12;

// Converts a raw per-period amount into a monthly-equivalent, computed once
// at write time and stored as `amount` so every existing percent/spent/pace
// calculation keeps working unchanged regardless of period_type. Weekly uses
// a fixed 52/12 average rather than the specific anchor month's week count,
// so the stored figure is a stable constant reused across every future
// applicable month instead of being biased by whichever month the budget
// happened to be created in — the exact per-month weekly total (which can
// differ slightly, e.g. a 5-Monday month) is shown separately on the card,
// not folded into this number.
export function monthlyEquivalentAmount(periodAmount: number, periodType: PeriodType): number {
  if (periodType === "weekly") return periodAmount * AVG_WEEKS_PER_MONTH;
  const interval = PERIOD_MONTH_INTERVAL[periodType] ?? 1;
  return periodAmount / interval;
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

// Whether a budget anchored at `anchorMonth` with the given period type
// counts as active in `targetMonth`. Weekly is always applicable (every
// month has at least one week); monthly degenerates to an exact match —
// which is what guarantees zero behavior change for every pre-existing row,
// all of which default to period_type "monthly".
export function isMonthApplicable(
  anchorMonth: string,
  periodType: PeriodType,
  targetMonth: string
): boolean {
  const diff = monthsBetween(anchorMonth, targetMonth);
  if (diff < 0) return false; // budgets don't apply retroactively before their anchor
  if (periodType === "weekly") return true;
  if (periodType === "monthly") return diff === 0;
  const interval = PERIOD_MONTH_INTERVAL[periodType]!;
  return diff % interval === 0;
}

// A safety bound generous enough for any real bi-annual (6-month) cycle,
// used by the two walk-forward helpers below instead of an exact interval
// count so they stay correct even if `fromMonth`/`fromDate` sits before the
// anchor month.
const MAX_WALK_MONTHS = 60;

// Up to `count` applicable months from `fromMonth` onward (inclusive) — for
// a card's "Applies to: ..." display. Not meaningful for weekly (always
// applicable, nothing informative to list).
export function upcomingApplicableMonths(
  anchorMonth: string,
  periodType: PeriodType,
  fromMonth: string,
  count = 3
): string[] {
  const months: string[] = [];
  let cursor = fromMonth;
  for (let i = 0; months.length < count && i < MAX_WALK_MONTHS; i++) {
    if (isMonthApplicable(anchorMonth, periodType, cursor)) months.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return months;
}

// The next month (from today's actual month forward, not whatever month is
// currently being browsed) this budget is next due in. Null for weekly
// (always "due") and monthly (doesn't recur cross-month).
export function nextDueDate(
  anchorMonth: string,
  periodType: PeriodType,
  fromDate: Date = new Date()
): string | null {
  if (periodType === "weekly" || periodType === "monthly") return null;
  let cursor = getCurrentMonthKey(fromDate);
  for (let i = 0; i < MAX_WALK_MONTHS; i++) {
    if (isMonthApplicable(anchorMonth, periodType, cursor)) return cursor;
    cursor = shiftMonthKey(cursor, 1);
  }
  return null;
}

// Monday-anchored week (Mon-Sun) containing `now`.
export function getWeekBounds(now: Date = new Date()): { from: string; to: string } {
  const day = now.getDay(); // 0 (Sun) .. 6 (Sat)
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: toISODate(monday), to: toISODate(sunday) };
}

// Every Monday-Sunday week block that overlaps the given "YYYY-MM" month —
// used both for the per-week breakdown display and for computing the exact
// per-month weekly total (see monthlyEquivalentAmount's doc comment for why
// that can differ slightly from the stored monthly-equivalent).
export function weeksInMonth(monthKey: string): { from: string; to: string }[] {
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const firstDayOfWeek = firstDay.getDay();
  const diffToMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
  let cursor = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate() + diffToMonday);

  const weeks: { from: string; to: string }[] = [];
  while (cursor <= lastDay) {
    const weekEnd = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 6);
    weeks.push({ from: toISODate(cursor), to: toISODate(weekEnd) });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7);
  }
  return weeks;
}
