import type { Transaction } from "./csv";
import { formatMonthKey } from "./budgets";
import { parseISODate, toISODate } from "./period";

export type GoalType = "savings" | "spending" | "debt";
export type GoalStatus = "onTrack" | "atRisk" | "completed";

export type Goal = {
  id: string;
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number; // persisted value — source of truth for debt, fallback for un-linked savings/spending
  targetDate: string; // "YYYY-MM-DD", always the 1st of the target month
  category: string | null;
  startingBalance: number | null; // debt only
  monthlyPayment: number | null; // debt only
  colour: string;
  emoji: string;
  notes: string | null;
  isCompleted: boolean;
  createdAt: string;
};

export type GoalProgress = {
  currentAmount: number;
  percent: number; // uncapped — a spending goal can exceed 100
  status: GoalStatus;
  projectedDate: Date | null;
  requiredMonthlyContribution: number;
  daysRemaining: number;
};

// Sums the absolute value of every transaction in `category`, optionally
// restricted to a single "YYYY-MM" month — mirrors how the budget cards
// total spend per category, so a linked goal's progress reads the same way
// budgets already do.
function sumCategoryAmount(transactions: Transaction[], category: string, monthKey?: string): number {
  const target = category.toLowerCase();
  let total = 0;
  for (const t of transactions) {
    if (t.category.toLowerCase() !== target) continue;
    if (monthKey && t.date.slice(0, 7) !== monthKey) continue;
    total += Math.abs(t.amount);
  }
  return total;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

// Whole calendar months between two dates (can be negative if `to` precedes
// `from`) — day-of-month is ignored, matching how the budget month-key
// helpers treat months as discrete units rather than exact 30-day spans.
function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Same on-track/at-risk pace check budgets use: projects month-end spend
// from the pace so far and compares it to the target. Only meaningful for
// the calendar month the goal is currently tracking.
function spendingPace(spent: number, targetAmount: number, monthKey: string, now: Date): GoalStatus {
  if (formatMonthKey(now) !== monthKey) {
    return spent <= targetAmount ? "onTrack" : "atRisk";
  }
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = Math.max(1, now.getDate());
  const projected = (spent / daysElapsed) * totalDays;
  return projected > targetAmount ? "atRisk" : "onTrack";
}

// Computes a goal's live progress. For a category-linked savings/spending
// goal, `currentAmount` is recomputed from `transactions` on every call
// (not read from the DB) so it updates in real time as uploads come in;
// debt goals (never category-linked) use the persisted amount instead.
export function computeGoalProgress(goal: Goal, transactions: Transaction[], now: Date = new Date()): GoalProgress {
  const targetDate = parseISODate(goal.targetDate);
  const daysRemaining = Math.round((startOfDay(targetDate).getTime() - startOfDay(now).getTime()) / 86400000);

  if (goal.type === "spending") {
    const monthKey = formatMonthKey(targetDate);
    const spent = goal.category ? sumCategoryAmount(transactions, goal.category, monthKey) : goal.currentAmount;
    const percent = goal.targetAmount > 0 ? (spent / goal.targetAmount) * 100 : 0;
    return {
      currentAmount: spent,
      percent,
      status: spendingPace(spent, goal.targetAmount, monthKey, now),
      projectedDate: null,
      requiredMonthlyContribution: goal.targetAmount,
      daysRemaining,
    };
  }

  const current =
    goal.type === "savings" && goal.category
      ? sumCategoryAmount(transactions, goal.category)
      : goal.currentAmount;
  const target = goal.targetAmount;
  const remaining = target - current;
  const percent = target > 0 ? Math.min(100, Math.max(0, (current / target) * 100)) : 0;

  if (remaining <= 0) {
    return {
      currentAmount: current,
      percent: 100,
      status: "completed",
      projectedDate: null,
      requiredMonthlyContribution: 0,
      daysRemaining,
    };
  }

  const createdAt = new Date(goal.createdAt);
  const monthsElapsed = Math.max(1, monthsBetween(createdAt, now));
  const avgMonthlyRate = current / monthsElapsed;
  const monthsUntilTarget = Math.max(1, monthsBetween(now, targetDate));
  const requiredMonthlyContribution = remaining / monthsUntilTarget;

  let projectedDate: Date | null = null;
  let status: GoalStatus;

  if (targetDate.getTime() < startOfDay(now).getTime()) {
    status = "atRisk";
  } else if (avgMonthlyRate <= 0) {
    // No progress yet — give a new goal the benefit of the doubt for its
    // first month, then flag it once time has passed with nothing logged.
    status = monthsElapsed <= 1 ? "onTrack" : "atRisk";
  } else {
    const monthsToGo = remaining / avgMonthlyRate;
    projectedDate = addMonths(now, Math.ceil(monthsToGo));
    status = projectedDate.getTime() <= targetDate.getTime() ? "onTrack" : "atRisk";
  }

  return { currentAmount: current, percent, status, projectedDate, requiredMonthlyContribution, daysRemaining };
}

// Converts an <input type="month"> value ("YYYY-MM") to the first-of-month
// ISO date the goals table stores.
export function monthInputToDate(monthValue: string): string {
  const [year, month] = monthValue.split("-").map(Number);
  return toISODate(new Date(year, month - 1, 1));
}

export function dateToMonthInput(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export const GOAL_EMOJI_OPTIONS = [
  "🎯", "🏠", "💰", "💳", "🚗", "✈️", "🎓", "💍",
  "👶", "🏥", "🎉", "📱", "💻", "🛋️", "🐶", "🎸",
  "📷", "⚡", "🏋️", "🌴", "🎁", "🍽️", "📚", "🛡️",
];

export const GOAL_COLOUR_OPTIONS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
];
