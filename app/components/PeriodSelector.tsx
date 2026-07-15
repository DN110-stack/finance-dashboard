"use client";

import { PERIOD_OPTIONS, type PeriodState } from "../lib/period";

type Props = {
  value: PeriodState;
  onChange: (value: PeriodState) => void;
};

export default function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PERIOD_OPTIONS.map((option) => {
        const isActive = value.option === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ ...value, option: option.value })}
            aria-pressed={isActive}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
            }`}
          >
            {option.label}
          </button>
        );
      })}

      {value.option === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.customFrom}
            onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            aria-label="Custom range from date"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-white/10"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>
          <input
            type="date"
            value={value.customTo}
            onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            aria-label="Custom range to date"
            className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-white/10"
          />
        </div>
      )}
    </div>
  );
}
