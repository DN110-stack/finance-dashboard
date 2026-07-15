"use client";

import { useMemo } from "react";
import { useTransactions } from "../../context/TransactionsContext";
import {
  filterTransactionsByPeriod,
  getPeriodRange,
  parseISODate,
  toISODate,
  type PeriodState,
} from "../../lib/period";
import EmptyChartState from "./EmptyChartState";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Sequential single hue (dataviz skill default "blue"), encoded as intensity
// via alpha rather than a discrete light/dark ramp — reads reasonably on both
// light and dark card surfaces without needing separate ramp steps per mode.
function intensityStyle(ratio: number): React.CSSProperties {
  if (ratio <= 0) return { backgroundColor: "transparent" };
  const alpha = 0.15 + ratio * 0.75;
  return { backgroundColor: `rgba(42, 120, 214, ${alpha.toFixed(2)})` };
}

type DayCell = { iso: string; day: number; total: number };
type MonthBlock = { monthKey: string; label: string; leadingBlanks: number; days: DayCell[] };

export default function DailySpendingHeatmap({ period }: { period: PeriodState }) {
  const { transactions } = useTransactions();

  const { months, maxTotal } = useMemo(() => {
    const range = getPeriodRange(period);
    if (!range) return { months: [] as MonthBlock[], maxTotal: 0 };

    const periodTransactions = filterTransactionsByPeriod(
      transactions.filter((t) => !t.isOneOff),
      period
    );

    const totalsByDay = new Map<string, number>();
    for (const transaction of periodTransactions) {
      if (transaction.amount >= 0) continue;
      totalsByDay.set(
        transaction.date,
        (totalsByDay.get(transaction.date) ?? 0) + Math.abs(transaction.amount)
      );
    }

    const monthMap = new Map<string, DayCell[]>();
    const cursor = parseISODate(range.from);
    const end = parseISODate(range.to);
    let maxTotal = 0;

    while (cursor <= end) {
      const iso = toISODate(cursor);
      const total = totalsByDay.get(iso) ?? 0;
      if (total > maxTotal) maxTotal = total;

      const monthKey = iso.slice(0, 7);
      const cells = monthMap.get(monthKey) ?? [];
      cells.push({ iso, day: cursor.getDate(), total });
      monthMap.set(monthKey, cells);

      cursor.setDate(cursor.getDate() + 1);
    }

    const months = Array.from(monthMap.entries()).map(([monthKey, days]) => {
      const firstOfMonth = parseISODate(`${monthKey}-01`);
      return {
        monthKey,
        label: firstOfMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        leadingBlanks: firstOfMonth.getDay(),
        days,
      };
    });

    return { months, maxTotal };
  }, [transactions, period]);

  if (months.length === 0) return <EmptyChartState />;

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {months.map((month) => (
        <div key={month.monthKey}>
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {month.label}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAY_LABELS.map((label, index) => (
              <div
                key={index}
                className="text-center text-[10px] text-zinc-400 dark:text-zinc-500"
              >
                {label}
              </div>
            ))}
            {Array.from({ length: month.leadingBlanks }).map((_, index) => (
              <div key={`blank-${index}`} />
            ))}
            {month.days.map((day) => (
              <div
                key={day.iso}
                title={`${day.iso}: $${day.total.toFixed(2)}`}
                style={intensityStyle(maxTotal > 0 ? day.total / maxTotal : 0)}
                className="flex aspect-square items-center justify-center rounded border border-black/10 text-[10px] text-zinc-500 dark:border-white/10 dark:text-zinc-400"
              >
                {day.day}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
