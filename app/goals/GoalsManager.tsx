"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PiggyBank, Plus } from "lucide-react";
import { useGoals } from "../context/GoalsContext";
import type { NewGoalInput } from "../context/GoalsContext";
import { useCategories } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import { computeGoalProgress, type Goal, type GoalProgress } from "../lib/goals";
import { BudgetCardsSkeleton } from "../components/Skeleton";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";
import GoalsSummary from "./GoalsSummary";
import FloatingAddButton from "../budget/FloatingAddButton";

const CARD_STAGGER_MS = 40;
// How long a card keeps its confetti burst mounted after a goal is first
// detected as complete — matches ConfettiBurst's own fall duration/delay
// range with a little headroom.
const CONFETTI_DURATION_MS = 3500;

export default function GoalsManager() {
  const { goals, isLoading: goalsLoading, addGoal, updateGoal, deleteGoal } = useGoals();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { transactions } = useTransactions();
  const isLoading = goalsLoading || categoriesLoading;

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loggingPaymentId, setLoggingPaymentId] = useState<string | null>(null);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  // Goal ids the completion effect has already tried to persist this
  // session — prevents re-firing the update on every transactions/goals
  // change while the request is in flight or after it fails once.
  const completionAttempted = useRef<Set<string>>(new Set());

  const progressByGoalId = useMemo(() => {
    const map = new Map<string, GoalProgress>();
    for (const goal of goals) map.set(goal.id, computeGoalProgress(goal, transactions));
    return map;
  }, [goals, transactions]);

  // Persists is_completed the first time a savings/debt goal's live
  // progress crosses its target, so it moves into the Completed section and
  // stays there even if a later transaction (e.g. a refund) dips the
  // computed total back down.
  useEffect(() => {
    for (const goal of goals) {
      if (goal.isCompleted) continue;
      if (completionAttempted.current.has(goal.id)) continue;
      const progress = progressByGoalId.get(goal.id);
      if (progress?.status !== "completed") continue;

      completionAttempted.current.add(goal.id);
      updateGoal(goal.id, { isCompleted: true, currentAmount: progress.currentAmount })
        .then(() => {
          setJustCompletedIds((prev) => new Set(prev).add(goal.id));
          setTimeout(() => {
            setJustCompletedIds((prev) => {
              const next = new Set(prev);
              next.delete(goal.id);
              return next;
            });
          }, CONFETTI_DURATION_MS);
        })
        .catch(() => {
          completionAttempted.current.delete(goal.id);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, progressByGoalId]);

  function clearActionError(id: string) {
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleOpenAdd() {
    setEditingGoal(null);
    setIsFormOpen(true);
  }

  function handleOpenEdit(goal: Goal) {
    setEditingGoal(goal);
    setIsFormOpen(true);
  }

  function handleCloseForm() {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingGoal(null);
  }

  async function handleFormSubmit(input: NewGoalInput) {
    setIsSaving(true);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, {
          name: input.name,
          targetAmount: input.targetAmount,
          targetDate: input.targetDate,
          category: input.category,
          startingBalance: input.startingBalance,
          monthlyPayment: input.monthlyPayment,
          colour: input.colour,
          emoji: input.emoji,
          notes: input.notes,
        });
      } else {
        await addGoal(input);
      }
      setIsFormOpen(false);
      setEditingGoal(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(goal: Goal) {
    const confirmed = window.confirm(`Delete the goal "${goal.name}"?`);
    if (!confirmed) return;

    setDeletingId(goal.id);
    clearActionError(goal.id);
    try {
      await deleteGoal(goal.id);
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [goal.id]: err instanceof Error ? err.message : "Failed to delete goal",
      }));
    } finally {
      setDeletingId(null);
    }
  }

  async function handleLogPayment(goal: Goal) {
    setLoggingPaymentId(goal.id);
    clearActionError(goal.id);
    try {
      const nextAmount = Math.min(goal.targetAmount, goal.currentAmount + (goal.monthlyPayment ?? 0));
      await updateGoal(goal.id, { currentAmount: nextAmount });
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [goal.id]: err instanceof Error ? err.message : "Failed to log payment",
      }));
    } finally {
      setLoggingPaymentId(null);
    }
  }

  const activeGoals = goals.filter((g) => progressByGoalId.get(g.id)?.status !== "completed");
  const completedGoals = goals.filter((g) => progressByGoalId.get(g.id)?.status === "completed");
  const showEmptyState = !isLoading && goals.length === 0 && !isFormOpen;
  const showFab = !isLoading && !showEmptyState;

  function renderGrid(list: Goal[]) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {list.map((goal, index) => {
          const progress = progressByGoalId.get(goal.id);
          if (!progress) return null;
          return (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={progress}
              animationDelayMs={index * CARD_STAGGER_MS}
              justCompleted={justCompletedIds.has(goal.id)}
              actionError={actionErrors[goal.id]}
              isDeleting={deletingId === goal.id}
              isLoggingPayment={loggingPaymentId === goal.id}
              onEdit={() => handleOpenEdit(goal)}
              onDelete={() => handleDelete(goal)}
              onLogPayment={goal.type === "debt" ? () => handleLogPayment(goal) : undefined}
            />
          );
        })}
      </div>
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-col gap-6">
        <GoalsSummary goals={goals} progressById={progressByGoalId} isLoading={isLoading} />

        {isLoading ? (
          <BudgetCardsSkeleton />
        ) : showEmptyState ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 p-10 text-center dark:border-white/10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <PiggyBank className="h-7 w-7" />
            </div>
            <p className="text-sm font-medium">No goals yet</p>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              Set a savings target, a monthly spending cap, or a debt payoff plan to start tracking
              progress automatically.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="mt-1 flex min-h-[44px] items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add goal
            </button>
          </div>
        ) : (
          <>
            {activeGoals.length > 0 && renderGrid(activeGoals)}

            {completedGoals.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">Completed</h2>
                {renderGrid(completedGoals)}
              </div>
            )}
          </>
        )}
      </div>

      {showFab && <FloatingAddButton label="Add goal" onClick={handleOpenAdd} />}

      {isFormOpen && (
        <GoalForm
          key={editingGoal?.id ?? "new"}
          categories={categories}
          goal={editingGoal}
          onSubmit={handleFormSubmit}
          onClose={handleCloseForm}
          isSaving={isSaving}
        />
      )}
    </>
  );
}
