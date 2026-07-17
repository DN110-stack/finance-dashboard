"use client";

import { PERIOD_OPTIONS, type PeriodState } from "../lib/period";

type Props = {
  value: PeriodState;
  onChange: (value: PeriodState) => void;
};

export default function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {PERIOD_OPTIONS.map((option) => {
          const isActive = value.option === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...value, option: option.value })}
              aria-pressed={isActive}
              className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
                isActive
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-black/10 text-zinc-700 hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {value.option === "custom" && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={value.customFrom}
            onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            aria-label="Custom range from date"
            className="min-h-[44px] rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-white/10"
          />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">to</span>
          <input
            type="date"
            value={value.customTo}
            onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            aria-label="Custom range to date"
            className="min-h-[44px] rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none dark:border-white/10"
          />
        </div>
      )}
    </div>
  );
}
