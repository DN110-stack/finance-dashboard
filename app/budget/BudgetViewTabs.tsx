"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import BudgetManager from "./BudgetManager";
import AnnualBudgetManager from "./AnnualBudgetManager";

const VIEWS = ["Monthly", "Annual"] as const;
type View = (typeof VIEWS)[number];

function viewFromDefaultBudgetView(value: "monthly" | "annual"): View {
  return value === "annual" ? "Annual" : "Monthly";
}

export default function BudgetViewTabs() {
  const { defaultBudgetView, isLoading } = useSettings();
  const [activeView, setActiveView] = useState<View>(() => viewFromDefaultBudgetView(defaultBudgetView));
  // Whether the user has manually picked a tab this session — once they
  // have, the settings fetch resolving (e.g. on a fresh device with no
  // localStorage cache yet) shouldn't yank them back to their saved default
  // out from under a deliberate click.
  const hasUserOverridden = useRef(false);

  // Patches in the resolved preference once, right when the settings fetch
  // finishes — not on every later defaultBudgetView change, and never if the
  // user has already clicked a tab.
  useEffect(() => {
    if (isLoading) return;
    if (hasUserOverridden.current) return;
    setActiveView(viewFromDefaultBudgetView(defaultBudgetView));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  function handleTabClick(view: View) {
    hasUserOverridden.current = true;
    setActiveView(view);
  }

  return (
    <>
      <div className="mt-4 flex gap-1 border-b border-black/10 dark:border-white/10">
        {VIEWS.map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => handleTabClick(view)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activeView === view
                ? "border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      {activeView === "Monthly" && <BudgetManager />}
      {activeView === "Annual" && <AnnualBudgetManager />}
    </>
  );
}
