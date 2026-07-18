"use client";

import { useSyncExternalStore } from "react";
import { TriangleAlert } from "lucide-react";
import ChartSlot from "./charts/ChartSlot";
import type { PeriodState } from "../lib/period";
import {
  CHART_COUNT_OPTIONS,
  chartCountStore,
  chartLayoutStore,
  type ChartCount,
  type ChartLayout,
  type ChartType,
} from "../lib/chartLayout";

// A slot spans the full grid width when it's the only chart shown, or when
// it's the third of exactly three (2 columns on top, 1 full-width below).
function isFullWidth(count: ChartCount, index: number): boolean {
  return count === 1 || (count === 3 && index === 2);
}

export default function ChartsSection({ period }: { period: PeriodState }) {
  const layout = useSyncExternalStore(
    chartLayoutStore.subscribe,
    chartLayoutStore.getSnapshot,
    chartLayoutStore.getServerSnapshot
  );
  const count = useSyncExternalStore(
    chartCountStore.subscribe,
    chartCountStore.getSnapshot,
    chartCountStore.getServerSnapshot
  );

  const visibleLayout = layout.slice(0, count);

  function updateSlot(index: number, chartType: ChartType) {
    const next = [...layout] as ChartLayout;
    next[index] = chartType;
    chartLayoutStore.set(next);
  }

  // A chart type appearing at more than one visible index counts as a
  // duplicate at every index it occupies, not just the second occurrence.
  // Slots hidden by the current count don't factor in — the user can't see
  // a conflict they can't see.
  const duplicateTypes = new Set(
    visibleLayout.filter((type, index) => visibleLayout.indexOf(type) !== index)
  );

  return (
    <>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Layout</span>
        <div className="flex rounded-md border border-black/10 p-0.5 dark:border-white/10">
          {CHART_COUNT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => chartCountStore.set(option)}
              aria-label={`Show ${option} chart${option === 1 ? "" : "s"}`}
              aria-pressed={count === option}
              className={`min-h-[36px] min-w-[36px] rounded px-2 text-sm font-medium transition-colors ${
                count === option
                  ? "bg-blue-600 text-white"
                  : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {duplicateTypes.size > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <TriangleAlert className="h-4 w-4" />
          The same chart is selected in more than one slot below.
        </p>
      )}

      <div
        className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${duplicateTypes.size > 0 ? "mt-2" : "mt-4"}`}
      >
        {visibleLayout.map((chartType, index) => (
          <div key={index} className={isFullWidth(count, index) ? "sm:col-span-2" : undefined}>
            <ChartSlot
              value={chartType}
              onChange={(next) => updateSlot(index, next)}
              period={period}
              isDuplicate={duplicateTypes.has(chartType)}
            />
          </div>
        ))}
      </div>
    </>
  );
}
