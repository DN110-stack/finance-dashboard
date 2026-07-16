"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "../lib/supabase/client";
import {
  settingsStore,
  type CachedSettings,
  type DefaultBudgetView,
  type FinancialYearPreference,
} from "../lib/settingsStorage";

type SettingsContextValue = CachedSettings & {
  isLoading: boolean;
  updateFinancialYearPreference: (value: FinancialYearPreference) => Promise<void>;
  updateDefaultBudgetView: (value: DefaultBudgetView) => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // localStorage-cached value, read via useSyncExternalStore so it renders
  // instantly (no flash of the default before the Supabase fetch resolves) —
  // same pattern DashboardContent.tsx already uses for chartLayoutStore.
  const cached = useSyncExternalStore(
    settingsStore.subscribe,
    settingsStore.getSnapshot,
    settingsStore.getServerSnapshot
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_settings")
          .select("financial_year_preference, default_budget_view")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!error && data && !cancelled) {
          settingsStore.set({
            financialYearPreference: data.financial_year_preference,
            defaultBudgetView: data.default_budget_view,
          });
        }
      } catch {
        // Leave the cached (localStorage or default) settings as-is.
      }

      if (!cancelled) setIsLoading(false);
    }

    // A hard navigation/reload while this is in flight aborts the underlying
    // fetch; without a rejection handler that surfaces as an unhandled
    // promise rejection in the console even though `cancelled` already
    // guards against any resulting state update.
    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Both setters await the Supabase upsert before touching the store —
  // matching the existing upsertBudget/upsertAnnualBudget await-then-reflect
  // precedent rather than updating optimistically.
  async function saveSettings(next: CachedSettings) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to change settings");
    }

    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        financial_year_preference: next.financialYearPreference,
        default_budget_view: next.defaultBudgetView,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw new Error(error.message);

    settingsStore.set(next);
  }

  async function updateFinancialYearPreference(value: FinancialYearPreference) {
    await saveSettings({ ...cached, financialYearPreference: value });
  }

  async function updateDefaultBudgetView(value: DefaultBudgetView) {
    await saveSettings({ ...cached, defaultBudgetView: value });
  }

  return (
    <SettingsContext.Provider
      value={{
        ...cached,
        isLoading,
        updateFinancialYearPreference,
        updateDefaultBudgetView,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
