"use client";

import { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { DefaultBudgetView, FinancialYearPreference } from "../lib/settingsStorage";

const FY_OPTIONS: { value: FinancialYearPreference; label: string }[] = [
  { value: "calendar", label: "Calendar Year (Jan–Dec)" },
  { value: "financial", label: "Financial Year (Jul–Jun)" },
];

const VIEW_OPTIONS: { value: DefaultBudgetView; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
];

export default function SettingsForm() {
  const {
    financialYearPreference,
    defaultBudgetView,
    updateFinancialYearPreference,
    updateDefaultBudgetView,
  } = useSettings();

  const [isSavingFY, setIsSavingFY] = useState(false);
  const [fyError, setFyError] = useState<string | null>(null);
  const [isSavingView, setIsSavingView] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);

  async function handleFyChange(value: FinancialYearPreference) {
    if (value === financialYearPreference) return;
    setIsSavingFY(true);
    setFyError(null);
    try {
      await updateFinancialYearPreference(value);
    } catch (err) {
      setFyError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSavingFY(false);
    }
  }

  async function handleViewChange(value: DefaultBudgetView) {
    if (value === defaultBudgetView) return;
    setIsSavingView(true);
    setViewError(null);
    try {
      await updateDefaultBudgetView(value);
    } catch (err) {
      setViewError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSavingView(false);
    }
  }

  return (
    <div className="mt-6 flex max-w-lg flex-col gap-8">
      <div>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Financial Year</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose how the app groups and labels years.
        </p>
        <div className="mt-3 flex w-fit flex-wrap rounded-md border border-black/10 p-0.5 dark:border-white/10">
          {FY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleFyChange(option.value)}
              disabled={isSavingFY}
              className={`min-h-[44px] rounded px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                financialYearPreference === option.value
                  ? "bg-blue-600 text-white"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {financialYearPreference === "financial" && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            FY2026 = Jul 2025 – Jun 2026. This only changes how the Annual Budget view and the
            dashboard&apos;s This/Last Year filters group and label years — monthly budgets are
            unaffected.
          </p>
        )}
        {fyError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{fyError}</p>}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Default Budget View</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Which tab the Budget page opens on.
        </p>
        <div className="mt-3 flex w-fit flex-wrap rounded-md border border-black/10 p-0.5 dark:border-white/10">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleViewChange(option.value)}
              disabled={isSavingView}
              className={`min-h-[44px] rounded px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                defaultBudgetView === option.value
                  ? "bg-blue-600 text-white"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {viewError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{viewError}</p>}
      </div>
    </div>
  );
}
