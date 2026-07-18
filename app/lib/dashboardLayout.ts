export type DashboardSectionId = "charts" | "budgets" | "goals";

export const DEFAULT_SECTION_ORDER: DashboardSectionId[] = ["charts", "budgets", "goals"];

const STORAGE_KEY = "finance-dashboard:section-order";

function isValidOrder(value: unknown): value is DashboardSectionId[] {
  return (
    Array.isArray(value) &&
    value.length === DEFAULT_SECTION_ORDER.length &&
    DEFAULT_SECTION_ORDER.every((id) => (value as unknown[]).includes(id)) &&
    value.every((id) => (DEFAULT_SECTION_ORDER as string[]).includes(id as string))
  );
}

function readFromStorage(): DashboardSectionId[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECTION_ORDER;

    const parsed = JSON.parse(raw);
    return isValidOrder(parsed) ? parsed : DEFAULT_SECTION_ORDER;
  } catch {
    return DEFAULT_SECTION_ORDER;
  }
}

// A small external store around localStorage, read via useSyncExternalStore
// rather than "load in a useEffect" — mirrors chartLayoutStore/goalLayoutStore.
let cachedOrder: DashboardSectionId[] | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): DashboardSectionId[] {
  if (cachedOrder === null) cachedOrder = readFromStorage();
  return cachedOrder;
}

function getServerSnapshot(): DashboardSectionId[] {
  return DEFAULT_SECTION_ORDER;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setOrder(order: DashboardSectionId[]) {
  cachedOrder = order;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  listeners.forEach((listener) => listener());
}

export const dashboardLayoutStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  set: setOrder,
};

// Swaps the section at `index` with its neighbour in `direction` — used by
// the mobile up/down buttons. A no-op past either end.
export function moveSection(
  order: DashboardSectionId[],
  index: number,
  direction: -1 | 1
): DashboardSectionId[] {
  const target = index + direction;
  if (target < 0 || target >= order.length) return order;

  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// Moves the section at `fromIndex` to `toIndex`, shifting the ones in
// between — used by drag-and-drop, where the dragged section can land
// anywhere, not just on an adjacent neighbour.
export function reorderSections(
  order: DashboardSectionId[],
  fromIndex: number,
  toIndex: number
): DashboardSectionId[] {
  if (fromIndex === toIndex) return order;
  const next = [...order];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
