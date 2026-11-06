"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BillOccurrence, BillStatus } from "../lib/bills";
import { toISODate } from "../lib/period";
import { useBillSchedule } from "../lib/useBillSchedule";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CHIP_STYLES: Record<BillStatus, string> = {
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  overdue: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  dueSoon: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
};

const DOT_STYLES: Record<BillStatus, string> = {
  paid: "bg-emerald-500",
  overdue: "bg-red-500",
  dueSoon: "bg-amber-500",
  upcoming: "bg-blue-500",
};

const MAX_CHIPS = 2;

// Month grid of bill due dates. Tapping a day lists that day's bills below
// the grid, rendered by the parent so the list and calendar views share one
// set of mark-paid/undo controls.
export default function BillsCalendar({
  today,
  renderOccurrence,
}: {
  today: string;
  renderOccurrence: (occurrence: BillOccurrence) => React.ReactNode;
}) {
  const todayDate = new Date();
  const [view, setView] = useState({ year: todayDate.getFullYear(), month: todayDate.getMonth() });
  const [selected, setSelected] = useState<string | null>(today);

  const monthStart = new Date(view.year, view.month, 1);
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
  const from = toISODate(monthStart);
  const to = toISODate(new Date(view.year, view.month, daysInMonth));
  const { occurrences } = useBillSchedule(from, to, today);

  const byDate = new Map<string, BillOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = byDate.get(occurrence.dueDate) ?? [];
    list.push(occurrence);
    byDate.set(occurrence.dueDate, list);
  }

  const monthTotal = occurrences.reduce((sum, o) => sum + o.bill.amount, 0);
  const monthRemaining = occurrences
    .filter((o) => o.status !== "paid")
    .reduce((sum, o) => sum + o.bill.amount, 0);

  function shiftMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
    setSelected(null);
  }

  const leadingBlanks = monthStart.getDay();
  const selectedOccurrences = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-semibold">
            {monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {currencyFormatter.format(monthRemaining)} left of {currencyFormatter.format(monthTotal)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {WEEKDAYS.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const iso = toISODate(new Date(view.year, view.month, day));
          const dayBills = byDate.get(iso) ?? [];
          const isToday = iso === today;
          const isSelected = iso === selected;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelected(isSelected ? null : iso)}
              aria-label={`${iso}, ${dayBills.length} bill${dayBills.length === 1 ? "" : "s"}`}
              aria-pressed={isSelected}
              className={`flex min-h-[56px] flex-col items-stretch gap-1 rounded-md border p-1 text-left transition-colors sm:min-h-[84px] sm:p-1.5 ${
                isSelected
                  ? "border-blue-500 bg-blue-500/5"
                  : "border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center self-start rounded-full text-xs ${
                  isToday ? "bg-blue-600 font-semibold text-white" : "text-zinc-600 dark:text-zinc-300"
                }`}
              >
                {day}
              </span>

              {/* Narrow screens: a dot per bill. Wider: named chips. */}
              <span className="flex flex-wrap gap-0.5 sm:hidden">
                {dayBills.slice(0, 4).map((o) => (
                  <span key={o.bill.id} className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[o.status]}`} />
                ))}
              </span>
              <span className="hidden flex-col gap-0.5 sm:flex">
                {dayBills.slice(0, MAX_CHIPS).map((o) => (
                  <span
                    key={o.bill.id}
                    className={`truncate rounded px-1 text-[11px] leading-4 ${CHIP_STYLES[o.status]}`}
                  >
                    {o.bill.name}
                  </span>
                ))}
                {dayBills.length > MAX_CHIPS && (
                  <span className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    +{dayBills.length - MAX_CHIPS} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {selected ? (
          selectedOccurrences.length > 0 ? (
            <ul className="flex flex-col gap-2">{selectedOccurrences.map(renderOccurrence)}</ul>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No bills due on this day.</p>
          )
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Select a day to see its bills.</p>
        )}
      </div>
    </div>
  );
}
