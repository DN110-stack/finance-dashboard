export type ChartType =
  | "spendingByCategory"
  | "monthlyCategoryBreakdown"
  | "incomeVsExpenses"
  | "savingsRateTrend"
  | "topMerchants"
  | "cashFlow"
  | "dailyHeatmap"
  | "budgetVsActual";

export const ALL_CHART_TYPES: ChartType[] = [
  "spendingByCategory",
  "monthlyCategoryBreakdown",
  "incomeVsExpenses",
  "savingsRateTrend",
  "topMerchants",
  "cashFlow",
  "dailyHeatmap",
  "budgetVsActual",
];

export type ChartLayout = [ChartType, ChartType, ChartType, ChartType];

export const DEFAULT_CHART_LAYOUT: ChartLayout = [
  "incomeVsExpenses",
  "spendingByCategory",
  "topMerchants",
  "cashFlow",
];

const STORAGE_KEY = "finance-dashboard:chart-layout";

function isChartType(value: unknown): value is ChartType {
  return typeof value === "string" && (ALL_CHART_TYPES as string[]).includes(value);
}

function readFromStorage(): ChartLayout {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_LAYOUT;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 4 || !parsed.every(isChartType)) {
      return DEFAULT_CHART_LAYOUT;
    }
    return parsed as ChartLayout;
  } catch {
    return DEFAULT_CHART_LAYOUT;
  }
}

// A small external store around localStorage, read via useSyncExternalStore
// rather than "load in a useEffect" — localStorage isn't available during
// server rendering, and a plain useEffect read would either mismatch the
// server-rendered HTML or require a setState call inside the effect body.
// useSyncExternalStore is the tool React designed specifically for this:
// getServerSnapshot supplies the SSR-safe default, and it reconciles the
// real client value right after hydration without a manual effect.
let cachedLayout: ChartLayout | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): ChartLayout {
  if (cachedLayout === null) cachedLayout = readFromStorage();
  return cachedLayout;
}

function getServerSnapshot(): ChartLayout {
  return DEFAULT_CHART_LAYOUT;
}

function subscribeToChartLayout(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setChartLayout(layout: ChartLayout) {
  cachedLayout = layout;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  listeners.forEach((listener) => listener());
}

export const chartLayoutStore = {
  subscribe: subscribeToChartLayout,
  getSnapshot,
  getServerSnapshot,
  set: setChartLayout,
};

// How many of the 4 slots above are currently visible — kept as a separate
// store from chartLayoutStore so switching the count down and back up
// doesn't lose whatever chart type was assigned to a temporarily-hidden slot.
export type ChartCount = 1 | 2 | 3 | 4;
export const CHART_COUNT_OPTIONS: ChartCount[] = [1, 2, 3, 4];
const DEFAULT_CHART_COUNT: ChartCount = 4;
const COUNT_STORAGE_KEY = "finance-dashboard:chart-count";

function isChartCount(value: unknown): value is ChartCount {
  return typeof value === "number" && (CHART_COUNT_OPTIONS as number[]).includes(value);
}

function readCountFromStorage(): ChartCount {
  try {
    const raw = window.localStorage.getItem(COUNT_STORAGE_KEY);
    if (!raw) return DEFAULT_CHART_COUNT;

    const parsed = JSON.parse(raw);
    return isChartCount(parsed) ? parsed : DEFAULT_CHART_COUNT;
  } catch {
    return DEFAULT_CHART_COUNT;
  }
}

let cachedCount: ChartCount | null = null;
const countListeners = new Set<() => void>();

function getCountSnapshot(): ChartCount {
  if (cachedCount === null) cachedCount = readCountFromStorage();
  return cachedCount;
}

function getCountServerSnapshot(): ChartCount {
  return DEFAULT_CHART_COUNT;
}

function subscribeToChartCount(callback: () => void) {
  countListeners.add(callback);
  return () => countListeners.delete(callback);
}

function setChartCount(count: ChartCount) {
  cachedCount = count;
  try {
    window.localStorage.setItem(COUNT_STORAGE_KEY, JSON.stringify(count));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  countListeners.forEach((listener) => listener());
}

export const chartCountStore = {
  subscribe: subscribeToChartCount,
  getSnapshot: getCountSnapshot,
  getServerSnapshot: getCountServerSnapshot,
  set: setChartCount,
};
