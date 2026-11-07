// Whether dashboard figures leave out transactions flagged as one-off.
// On by default — one-offs (a car purchase, a tax refund) would otherwise
// swamp the everyday-spending picture. Same localStorage-backed external
// store pattern as chartLayoutStore.

const STORAGE_KEY = "finance-dashboard:exclude-one-offs";
const DEFAULT_EXCLUDE_ONE_OFFS = true;

function readFromStorage(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_EXCLUDE_ONE_OFFS;
    return JSON.parse(raw) !== false;
  } catch {
    return DEFAULT_EXCLUDE_ONE_OFFS;
  }
}

let cached: boolean | null = null;
const listeners = new Set<() => void>();

export const excludeOneOffsStore = {
  subscribe(callback: () => void) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  getSnapshot(): boolean {
    if (cached === null) cached = readFromStorage();
    return cached;
  },
  getServerSnapshot(): boolean {
    return DEFAULT_EXCLUDE_ONE_OFFS;
  },
  set(value: boolean) {
    cached = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Persistence is a nice-to-have — see chartLayoutStore.
    }
    listeners.forEach((listener) => listener());
  },
};
