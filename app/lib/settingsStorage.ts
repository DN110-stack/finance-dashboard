export type FinancialYearPreference = "calendar" | "financial";
export type DefaultBudgetView = "monthly" | "annual";

export type CachedSettings = {
  financialYearPreference: FinancialYearPreference;
  defaultBudgetView: DefaultBudgetView;
};

export const DEFAULT_SETTINGS: CachedSettings = {
  financialYearPreference: "calendar",
  defaultBudgetView: "monthly",
};

const STORAGE_KEY = "finance-dashboard:user-settings";

function isFinancialYearPreference(value: unknown): value is FinancialYearPreference {
  return value === "calendar" || value === "financial";
}

function isDefaultBudgetView(value: unknown): value is DefaultBudgetView {
  return value === "monthly" || value === "annual";
}

function readFromStorage(): CachedSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !isFinancialYearPreference(parsed.financialYearPreference) ||
      !isDefaultBudgetView(parsed.defaultBudgetView)
    ) {
      return DEFAULT_SETTINGS;
    }
    return {
      financialYearPreference: parsed.financialYearPreference,
      defaultBudgetView: parsed.defaultBudgetView,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// A small external store around localStorage, read via useSyncExternalStore
// rather than "load in a useEffect" — same rationale and shape as
// chartLayoutStore in app/lib/chartLayout.ts: localStorage isn't available
// during server rendering, getServerSnapshot supplies the SSR-safe default,
// and it reconciles the real client value right after hydration without a
// manual effect. This also lets non-React modules (app/lib/period.ts) read
// the current preference synchronously without needing a Context.
let cachedSettings: CachedSettings | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): CachedSettings {
  if (cachedSettings === null) cachedSettings = readFromStorage();
  return cachedSettings;
}

function getServerSnapshot(): CachedSettings {
  return DEFAULT_SETTINGS;
}

function subscribeToSettings(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setSettings(settings: CachedSettings) {
  cachedSettings = settings;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Persistence is a nice-to-have — a full quota or private-browsing
    // restriction shouldn't surface as an error to the user.
  }
  listeners.forEach((listener) => listener());
}

export const settingsStore = {
  subscribe: subscribeToSettings,
  getSnapshot,
  getServerSnapshot,
  set: setSettings,
};
