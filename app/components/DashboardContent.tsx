"use client";

import { useState, useSyncExternalStore } from "react";
import { TriangleAlert } from "lucide-react";
import SummaryCards from "./SummaryCards";
import ChatPanel from "./ChatPanel";
import PeriodSelector from "./PeriodSelector";
import ChartSlot from "./charts/ChartSlot";
import { DEFAULT_PERIOD, getPeriodRange, type PeriodState } from "../lib/period";
import { chartLayoutStore, type ChartLayout, type ChartType } from "../lib/chartLayout";

export default function DashboardContent() {
  const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD);
  const layout = useSyncExternalStore(
    chartLayoutStore.subscribe,
    chartLayoutStore.getSnapshot,
    chartLayoutStore.getServerSnapshot
  );
  const isCustomIncomplete = period.option === "custom" && !getPeriodRange(period);

  function updateSlot(index: number, chartType: ChartType) {
    const next = [...layout] as ChartLayout;
    next[index] = chartType;
    chartLayoutStore.set(next);
  }

  // A chart type appearing at more than one index counts as a duplicate at
  // every index it occupies, not just the second occurrence.
  const duplicateTypes = new Set(
    layout.filter((type, index) => layout.indexOf(type) !== index)
  );

  return (
    <>
      <div className="mt-6">
        <PeriodSelector value={period} onChange={setPeriod} />
        {isCustomIncomplete && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Choose both a from and to date to see this period.
          </p>
        )}
      </div>

      <SummaryCards period={period} />

      {duplicateTypes.size > 0 && (
        <p className="mt-6 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <TriangleAlert className="h-4 w-4" />
          The same chart is selected in more than one slot below.
        </p>
      )}

      <div
        className={`grid grid-cols-1 gap-6 lg:grid-cols-2 ${
          duplicateTypes.size > 0 ? "mt-2" : "mt-6"
        }`}
      >
        {layout.map((chartType, index) => (
          <ChartSlot
            key={index}
            value={chartType}
            onChange={(next) => updateSlot(index, next)}
            period={period}
            isDuplicate={duplicateTypes.has(chartType)}
          />
        ))}
      </div>

      <ChatPanel />
    </>
  );
}
