"use client";

import { CalendarClock, PiggyBank, Target } from "lucide-react";
import type { Goal, GoalProgress } from "../lib/goals";
import { parseISODate } from "../lib/period";
import { SummaryCardsSkeleton } from "../components/Skeleton";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function GoalsSummary({
  goals,
  progressById,
  isLoading,
}: {
  goals: Goal[];
  progressById: Map<string, GoalProgress>;
  isLoading: boolean;
}) {
  if (isLoading) return <SummaryCardsSkeleton />;

  const inProgress = goals.filter((g) => progressById.get(g.id)?.status !== "completed");

  const totalSaved = goals
    .filter((g) => g.type === "savings")
    .reduce((sum, g) => sum + (progressById.get(g.id)?.currentAmount ?? g.currentAmount), 0);

  const nearestDeadline = [...inProgress].sort(
    (a, b) => parseISODate(a.targetDate).getTime() - parseISODate(b.targetDate).getTime()
  )[0];

  const cards = [
    {
      label: "Goals in Progress",
      value: String(inProgress.length),
      icon: Target,
      iconClass: "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: "Total Saved",
      value: currencyFormatter.format(totalSaved),
      icon: PiggyBank,
      iconClass: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      label: "Nearest Deadline",
      value: nearestDeadline
        ? `${nearestDeadline.emoji} ${nearestDeadline.name}`
        : "—",
      subvalue: nearestDeadline
        ? parseISODate(nearestDeadline.targetDate).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })
        : undefined,
      icon: CalendarClock,
      iconClass: "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-lg border border-black/10 p-3 transition-shadow hover:shadow-sm sm:gap-4 sm:p-4 dark:border-white/10"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${card.iconClass}`}
            >
              <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-zinc-500 sm:text-sm dark:text-zinc-400">{card.label}</p>
              <p className="mt-1 truncate text-lg font-semibold sm:text-2xl">{card.value}</p>
              {card.subvalue && (
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{card.subvalue}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
