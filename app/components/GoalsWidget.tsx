"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, Target, TriangleAlert } from "lucide-react";
import { useGoals } from "../context/GoalsContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "../lib/csv";
import { computeGoalProgress, type Goal } from "../lib/goals";
import { goalLayoutStore, MAX_GOAL_SLOTS, resolveGoalLayout, type GoalSlotValue } from "../lib/goalLayout";
import { Skeleton } from "./Skeleton";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function GoalsWidget() {
  const { goals, isLoading } = useGoals();
  const { transactions } = useTransactions();
  const storedLayout = useSyncExternalStore(
    goalLayoutStore.subscribe,
    goalLayoutStore.getSnapshot,
    goalLayoutStore.getServerSnapshot
  );

  const slotCount = Math.min(MAX_GOAL_SLOTS, goals.length);
  const goalIds = useMemo(() => goals.map((g) => g.id), [goals]);
  const layout = useMemo(
    () => resolveGoalLayout(storedLayout, goalIds, slotCount),
    [storedLayout, goalIds, slotCount]
  );
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  function updateSlot(index: number, goalId: GoalSlotValue) {
    const next = [...layout];
    next[index] = goalId;
    goalLayoutStore.set(next);
  }

  return (
    <>
      {isLoading ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-black/10 p-8 text-center dark:border-white/10">
          <Target className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No goals yet — create one in the{" "}
            <Link href="/goals" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Goals tab
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {layout.map((selectedId, index) => (
            <GoalSlot
              key={index}
              goals={goals}
              selectedId={selectedId}
              goal={selectedId ? (goalById.get(selectedId) ?? null) : null}
              transactions={transactions}
              onChange={(next) => updateSlot(index, next)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function GoalSlot({
  goals,
  selectedId,
  goal,
  transactions,
  onChange,
}: {
  goals: Goal[];
  selectedId: GoalSlotValue;
  goal: Goal | null;
  transactions: Transaction[];
  onChange: (value: GoalSlotValue) => void;
}) {
  const progress = goal ? computeGoalProgress(goal, transactions) : null;
  const barPercent = progress ? Math.min(100, Math.max(0, progress.percent)) : 0;

  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="relative inline-flex w-full items-center">
        <select
          value={selectedId ?? "none"}
          onChange={(e) => onChange(e.target.value === "none" ? null : e.target.value)}
          aria-label="Goal slot"
          className="min-h-[36px] w-full appearance-none truncate rounded-md border border-transparent bg-transparent py-1 pl-1 pr-6 text-xs font-medium text-zinc-500 outline-none transition-colors hover:border-black/10 focus:border-black/20 dark:text-zinc-400 dark:hover:border-white/10 dark:focus:border-white/20"
        >
          <option value="none">None</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.emoji} {g.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
      </div>

      {goal && progress ? (
        <Link
          href="/goals"
          className="mt-1 block rounded-md p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
        >
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
              style={{ backgroundColor: `${goal.colour}26` }}
            >
              {goal.emoji}
            </span>
            <div className="flex-1" />
            {progress.status === "completed" ? (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                <CircleCheck className="h-3 w-3" />
                Done
              </span>
            ) : (
              <span
                className={`flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
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
          </div>

          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${barPercent}%`, backgroundColor: goal.colour }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              {currencyFormatter.format(progress.currentAmount)} of {currencyFormatter.format(goal.targetAmount)}
            </span>
            <span>{Math.round(progress.percent)}%</span>
          </div>
        </Link>
      ) : (
        <div className="mt-1 flex h-24 items-center justify-center text-xs text-zinc-400 dark:text-zinc-500">
          No goal selected
        </div>
      )}
    </div>
  );
}
