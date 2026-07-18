export type BudgetSlotValue = string | null; // a budget item key ("single:<id>" or "group:<id>"), or null for "None"
export type BudgetLayout = BudgetSlotValue[];

export const MAX_BUDGET_SLOTS = 4;

const STORAGE_KEY = "finance-dashboard:budget-layout";

function isValidLayout(value: unknown): value is BudgetLayout {
  return (
    Array.isArray(value) &&
    value.length <= MAX_BUDGET_SLOTS &&
    value.every((entry) => entry === null || typeof entry === "string")
  );
}

// null return means "the user has never customized this" — distinct from a
// persisted layout of all-nulls, which means every slot was deliberately set
// to "None". Mirrors goalLayout.ts's store, one per dashboard widget.
function readFromStorage(): BudgetLayout | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isValidLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

let cachedLayout: BudgetLayout | null | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): BudgetLayout | null {
  if (cachedLayout === undefined) cachedLayout = readFromStorage();
  return cachedLayout;
}

function getServerSnapshot(): BudgetLayout | null {
  return null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setBudgetLayout(layout: BudgetLayout) {
  cachedLayout = layout;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  listeners.forEach((listener) => listener());
}

export const budgetLayoutStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  set: setBudgetLayout,
};

// Resolves what each visible slot should show: the user's saved choice once
// they've customized the widget, sliced/padded to the current slot count, or
// — before any customization exists — the first `slotCount` items.
export function resolveBudgetLayout(
  stored: BudgetLayout | null,
  itemKeys: string[],
  slotCount: number
): BudgetSlotValue[] {
  if (stored) {
    const layout = stored.slice(0, slotCount);
    while (layout.length < slotCount) layout.push(null);
    return layout;
  }
  return itemKeys.slice(0, slotCount);
}
