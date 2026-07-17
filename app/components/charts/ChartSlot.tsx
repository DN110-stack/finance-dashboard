"use client";

import { ChevronDown, Info } from "lucide-react";
import { useTransactions } from "../../context/TransactionsContext";
import { ALL_CHART_TYPES, type ChartType } from "../../lib/chartLayout";
import type { PeriodState } from "../../lib/period";
import { CHART_DEFINITIONS } from "./registry";
import { ChartSkeleton } from "../Skeleton";

type Props = {
  value: ChartType;
  onChange: (value: ChartType) => void;
  period: PeriodState;
  isDuplicate: boolean;
};

export default function ChartSlot({ value, onChange, period, isDuplicate }: Props) {
  const definition = CHART_DEFINITIONS[value];
  const ChartComponent = definition.component;
  const { isLoading } = useTransactions();

  return (
    <div
      className={`rounded-lg border p-4 ${
        isDuplicate
          ? "border-amber-500/50 dark:border-amber-500/40"
          : "border-black/10 dark:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="relative inline-flex min-w-0 items-center">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value as ChartType)}
            aria-label="Chart type"
            className="min-h-[44px] max-w-full appearance-none truncate rounded-md border border-transparent bg-transparent py-1 -ml-1 pl-1 pr-6 text-base font-semibold text-zinc-900 outline-none transition-colors hover:border-black/10 focus:border-black/20 sm:min-h-0 sm:text-lg dark:text-white dark:hover:border-white/10 dark:focus:border-white/20"
          >
            {ALL_CHART_TYPES.map((type) => (
              <option key={type} value={type}>
                {CHART_DEFINITIONS[type].label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 shrink-0 text-zinc-400 dark:text-zinc-500" />
        </div>
        <span title={definition.description} className="shrink-0 pt-2.5">
          <Info className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
        </span>
      </div>

      {isDuplicate && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
          This chart is also shown in another slot.
        </p>
      )}

      <div className="mt-4 h-64 sm:h-80">
        {isLoading ? <ChartSkeleton /> : <ChartComponent period={period} />}
      </div>
    </div>
  );
}
