"use client";

import { useState } from "react";
import SummaryCards from "./SummaryCards";
import SpendingChart from "./SpendingChart";
import MonthlyCategoryChart from "./MonthlyCategoryChart";
import ChatPanel from "./ChatPanel";
import PeriodSelector from "./PeriodSelector";
import { DEFAULT_PERIOD, getPeriodRange, type PeriodState } from "../lib/period";

export default function DashboardContent() {
  const [period, setPeriod] = useState<PeriodState>(DEFAULT_PERIOD);
  const isCustomIncomplete = period.option === "custom" && !getPeriodRange(period);

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

      <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Spending</h2>
        <div className="mt-4 h-64 sm:h-80">
          <SpendingChart period={period} />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-lg font-semibold">Monthly Expenses by Category</h2>
        <div className="mt-4 h-64 sm:h-80">
          <MonthlyCategoryChart period={period} />
        </div>
      </div>

      <ChatPanel />
    </>
  );
}
