"use client";

import { Info } from "lucide-react";
import { ALL_CHART_TYPES, type ChartType } from "../../lib/chartLayout";
import type { PeriodState } from "../../lib/period";
import { CHART_DEFINITIONS } from "./registry";

type Props = {
  value: ChartType;
  onChange: (value: ChartType) => void;
  period: PeriodState;
  isDuplicate: boolean;
};

export default function ChartSlot({ value, onChange, period, isDuplicate }: Props) {
  const definition = CHART_DEFINITIONS[value];
  const ChartComponent = definition.component;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isDuplicate
          ? "border-amber-500/50 dark:border-amber-500/40"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-semibold">{definition.label}</h2>
          <span title={definition.description}>
            <Info className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          </span>
        </div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as ChartType)}
          aria-label="Chart type"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm focus:border-black/20 focus:outline-none dark:border-white/10 dark:focus:border-white/20"
        >
          {ALL_CHART_TYPES.map((type) => (
            <option key={type} value={type}>
              {CHART_DEFINITIONS[type].label}
            </option>
          ))}
        </select>
      </div>

      {isDuplicate && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          This chart is also shown in another slot.
        </p>
      )}

      <div className="mt-4 h-64 sm:h-80">
        <ChartComponent period={period} />
      </div>
    </div>
  );
}
