"use client";

import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { formatDueDate } from "../lib/bills";
import { toISODate } from "../lib/period";
import { useBillSchedule } from "../lib/useBillSchedule";

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// A couple of weeks back so a just-missed bill still nags until it's paid.
const OVERDUE_LOOKBACK_DAYS = 14;

// Dashboard banner for unpaid bills that are overdue or due within the
// user's reminder window. Renders nothing when there's nothing to flag.
export default function BillsReminder() {
  const now = new Date();
  const today = toISODate(now);
  const from = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - OVERDUE_LOOKBACK_DAYS));
  const to = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14));
  const { occurrences, isLoading } = useBillSchedule(from, to, today);

  if (isLoading) return null;

  const flagged = occurrences.filter((o) => o.status === "overdue" || o.status === "dueSoon");
  if (flagged.length === 0) return null;

  const hasOverdue = flagged.some((o) => o.status === "overdue");
  const total = flagged.reduce((sum, o) => sum + o.bill.amount, 0);

  return (
    <Link
      href="/bills"
      className={`mt-6 block rounded-lg border p-3 transition-colors sm:p-4 ${
        hasOverdue
          ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/10"
          : "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10"
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarClock
          className={`h-4 w-4 ${hasOverdue ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
        />
        {hasOverdue ? "Bills need attention" : "Bills coming up"} · {currencyFormatter.format(total)}
      </div>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {flagged.map((o) => (
          <li key={`${o.bill.id}|${o.dueDate}`} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">
              {o.bill.name}
              <span
                className={`ml-2 text-xs ${
                  o.status === "overdue"
                    ? "text-red-600 dark:text-red-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {o.status === "overdue" ? "Overdue · " : ""}
                {formatDueDate(o.dueDate, today)}
              </span>
            </span>
            <span className="shrink-0 font-medium">{currencyFormatter.format(o.bill.amount)}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}
