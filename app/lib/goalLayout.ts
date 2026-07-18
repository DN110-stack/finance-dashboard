export type GoalSlotValue = string | null; // a goal id, or null for "None"
export type GoalLayout = GoalSlotValue[];

export const MAX_GOAL_SLOTS = 4;

const STORAGE_KEY = "finance-dashboard:goal-layout";

function isValidLayout(value: unknown): value is GoalLayout {
  return (
    Array.isArray(value) &&
    value.length <= MAX_GOAL_SLOTS &&
    value.every((entry) => entry === null || typeof entry === "string")
  );
}

// null return means "the user has never customized this" — distinct from a
// persisted layout of all-nulls, which means every slot was deliberately set
// to "None". Callers use that distinction to decide whether to fall back to
// an auto-picked default.
function readFromStorage(): GoalLayout | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return isValidLayout(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// A small external store around localStorage, read via useSyncExternalStore
// rather than "load in a useEffect" — localStorage isn't available during
// server rendering, and a plain useEffect read would either mismatch the
// server-rendered HTML or require a setState call inside the effect body.
// Mirrors chartLayoutStore's precedent (see chartLayout.ts).
let cachedLayout: GoalLayout | null | undefined;
const listeners = new Set<() => void>();

function getSnapshot(): GoalLayout | null {
  if (cachedLayout === undefined) cachedLayout = readFromStorage();
  return cachedLayout;
}

function getServerSnapshot(): GoalLayout | null {
  return null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setGoalLayout(layout: GoalLayout) {
  cachedLayout = layout;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  listeners.forEach((listener) => listener());
}

export const goalLayoutStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  set: setGoalLayout,
};

// Resolves what each visible slot should show: the user's saved choice once
// they've customized the widget, sliced/padded to the current slot count
// (padding with "None" if they had fewer goals last time they saved), or —
// before any customization exists — the first `slotCount` goals as a
// reasonable starting point.
export function resolveGoalLayout(
  stored: GoalLayout | null,
  goalIds: string[],
  slotCount: number
): GoalSlotValue[] {
  if (stored) {
    const layout = stored.slice(0, slotCount);
    while (layout.length < slotCount) layout.push(null);
    return layout;
  }
  return goalIds.slice(0, slotCount);
}
