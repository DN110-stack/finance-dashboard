export type SummaryStatType =
  | "currentBalance"
  | "income"
  | "expenses"
  | "savingsRate"
  | "netCashFlow"
  | "avgDailySpend"
  | "largestExpense"
  | "topCategory"
  | "transactionCount"
  | "avgExpense"
  | "balanceRunway"
  | "billsRemaining"
  | "nextBill";

export const ALL_SUMMARY_STAT_TYPES: SummaryStatType[] = [
  "currentBalance",
  "income",
  "expenses",
  "savingsRate",
  "netCashFlow",
  "avgDailySpend",
  "largestExpense",
  "topCategory",
  "transactionCount",
  "avgExpense",
  "balanceRunway",
  "billsRemaining",
  "nextBill",
];

export type SummaryLayout = [SummaryStatType, SummaryStatType, SummaryStatType, SummaryStatType];

export const DEFAULT_SUMMARY_LAYOUT: SummaryLayout = [
  "currentBalance",
  "income",
  "expenses",
  "savingsRate",
];

const STORAGE_KEY = "finance-dashboard:summary-layout";

function isSummaryStatType(value: unknown): value is SummaryStatType {
  return typeof value === "string" && (ALL_SUMMARY_STAT_TYPES as string[]).includes(value);
}

function readFromStorage(): SummaryLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SUMMARY_LAYOUT;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 4 || !parsed.every(isSummaryStatType)) {
      return DEFAULT_SUMMARY_LAYOUT;
    }
    return parsed as SummaryLayout;
  } catch {
    return DEFAULT_SUMMARY_LAYOUT;
  }
}

// A small external store around localStorage, read via useSyncExternalStore —
// mirrors chartLayoutStore so the summary cards persist the same way.
let cachedLayout: SummaryLayout | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): SummaryLayout {
  if (cachedLayout === null) cachedLayout = readFromStorage();
  return cachedLayout;
}

function getServerSnapshot(): SummaryLayout {
  return DEFAULT_SUMMARY_LAYOUT;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setLayout(layout: SummaryLayout) {
  cachedLayout = layout;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  listeners.forEach((listener) => listener());
}

export const summaryLayoutStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  set: setLayout,
};
