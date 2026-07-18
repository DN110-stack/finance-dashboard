"use client";

import { CircleCheck, PiggyBank, Pencil, Trash2, TriangleAlert } from "lucide-react";
import type { Goal, GoalProgress } from "../lib/goals";
import { parseISODate, toISODate } from "../lib/period";
import ConfettiBurst from "./ConfettiBurst";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const TYPE_LABEL: Record<Goal["type"], string> = {
  savings: "Savings",
  spending: "Spending",
  debt: "Debt payoff",
};

function formatDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function GoalCard({
  goal,
  progress,
  animationDelayMs,
  justCompleted,
  actionError,
  isDeleting,
  isLoggingPayment,
  onEdit,
  onDelete,
  onLogPayment,
}: {
  goal: Goal;
  progress: GoalProgress;
  animationDelayMs: number;
  justCompleted: boolean;
  actionError?: string;
  isDeleting: boolean;
  isLoggingPayment: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLogPayment?: () => void;
}) {
  const isCompleted = progress.status === "completed";
  const barPercent = Math.min(100, Math.max(0, progress.percent));
  const canLogPayment = goal.type === "debt" && !isCompleted && !!onLogPayment;

  return (
    <div
      style={{ animationDelay: `${animationDelayMs}ms` }}
      className="relative animate-[budget-card-in_0.35s_ease-out_backwards] overflow-hidden rounded-xl border border-black/10 p-4 transition-shadow hover:shadow-lg dark:border-white/10"
    >
      {justCompleted && <ConfettiBurst />}

      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${goal.colour}26` }}
          >
            {goal.emoji}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{goal.name}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{TYPE_LABEL[goal.type]}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${goal.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            aria-label={`Delete ${goal.name}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {isCompleted ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CircleCheck className="h-3 w-3" />
            Completed
          </span>
        ) : (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              progress.status === "atRisk"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
            }`}
          >
            {progress.status === "atRisk" ? (
              <TriangleAlert className="h-3 w-3" />
            ) : (
              <CircleCheck className="h-3 w-3" />
            )}
            {progress.status === "atRisk" ? "At risk" : "On track"}
          </span>
        )}
        {goal.category && (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-white/10 dark:text-zinc-400">
            {goal.category}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${barPercent}%`, backgroundColor: goal.colour }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="text-sm font-medium">
            {currencyFormatter.format(progress.currentAmount)}
            <span className="text-zinc-500 dark:text-zinc-400"> of {currencyFormatter.format(goal.targetAmount)}</span>
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">{Math.round(progress.percent)}%</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {!isCompleted && goal.type !== "spending" && (
          <div>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              {progress.projectedDate ? formatDate(toISODate(progress.projectedDate)) : "—"}
            </p>
            <p>Projected completion</p>
          </div>
        )}
        {!isCompleted && goal.type !== "spending" && (
          <div>
            <p className="font-medium text-zinc-700 dark:text-zinc-300">
              {currencyFormatter.format(progress.requiredMonthlyContribution)}/mo
            </p>
            <p>Needed to stay on time</p>
          </div>
        )}
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">{formatDate(goal.targetDate)}</p>
          <p>Target date</p>
        </div>
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            {progress.daysRemaining < 0 ? "Past due" : `${progress.daysRemaining} days`}
          </p>
          <p>Remaining</p>
        </div>
      </div>

      {goal.notes && <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{goal.notes}</p>}

      {canLogPayment && (
        <button
          type="button"
          onClick={onLogPayment}
          disabled={isLoggingPayment}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md border border-black/10 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
        >
          <PiggyBank className="h-4 w-4" />
          {isLoggingPayment
            ? "Logging…"
            : `Log payment (${currencyFormatter.format(goal.monthlyPayment ?? 0)})`}
        </button>
      )}

      {actionError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionError}</p>}
    </div>
  );
}
