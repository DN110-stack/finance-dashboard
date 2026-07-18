"use client";

import { useState } from "react";
import { CreditCard, PiggyBank, Plus, TrendingDown } from "lucide-react";
import { useCategories, type Category } from "../context/CategoriesContext";
import type { NewGoalInput } from "../context/GoalsContext";
import type { Goal, GoalType } from "../lib/goals";
import { dateToMonthInput, GOAL_COLOUR_OPTIONS, GOAL_EMOJI_OPTIONS, monthInputToDate } from "../lib/goals";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, PARENT_CATEGORIES } from "../lib/categories";
import BottomSheet from "../components/BottomSheet";

const TYPE_OPTIONS: { value: GoalType; label: string; icon: typeof PiggyBank }[] = [
  { value: "savings", label: "Savings", icon: PiggyBank },
  { value: "spending", label: "Spending", icon: TrendingDown },
  { value: "debt", label: "Debt payoff", icon: CreditCard },
];

function defaultTargetMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function GoalForm({
  categories,
  goal,
  onSubmit,
  onClose,
  isSaving,
}: {
  categories: Category[];
  goal: Goal | null; // null = creating a new goal
  onSubmit: (input: NewGoalInput) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(goal?.name ?? "");
  const [type, setType] = useState<GoalType>(goal?.type ?? "savings");
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.targetAmount) : "");
  const [startingBalance, setStartingBalance] = useState(goal?.startingBalance ? String(goal.startingBalance) : "");
  const [monthlyPayment, setMonthlyPayment] = useState(goal?.monthlyPayment ? String(goal.monthlyPayment) : "");
  const [targetMonth, setTargetMonth] = useState(goal ? dateToMonthInput(goal.targetDate) : defaultTargetMonth());
  const [categoryName, setCategoryName] = useState(goal?.category ?? categories[0]?.name ?? "");
  const [notes, setNotes] = useState(goal?.notes ?? "");
  const [colour, setColour] = useState(goal?.colour ?? GOAL_COLOUR_OPTIONS[0]);
  const [emoji, setEmoji] = useState(goal?.emoji ?? GOAL_EMOJI_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);

  const { addCategory } = useCategories();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParent, setNewCategoryParent] = useState<string>(PARENT_CATEGORIES[PARENT_CATEGORIES.length - 1]);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);

  const isEditing = !!goal;
  const needsCategory = type === "savings" || type === "spending";

  function handleOpenAddCategory() {
    setIsAddingCategory(true);
    setNewCategoryName("");
    setNewCategoryParent(PARENT_CATEGORIES[PARENT_CATEGORIES.length - 1]);
    setNewCategoryError(null);
  }

  function handleCancelAddCategory() {
    setIsAddingCategory(false);
    setNewCategoryError(null);
  }

  async function handleSaveNewCategory() {
    const trimmedName = newCategoryName.trim();
    if (!trimmedName) {
      setNewCategoryError("Enter a category name");
      return;
    }

    setIsSavingCategory(true);
    setNewCategoryError(null);
    try {
      const colourForParent = CATEGORY_COLORS[newCategoryParent]?.hex ?? DEFAULT_CATEGORY_COLOR.hex;
      const created = await addCategory(trimmedName, colourForParent, newCategoryParent);
      setCategoryName(created.name);
      setIsAddingCategory(false);
      setNewCategoryName("");
    } catch (err) {
      setNewCategoryError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSavingCategory(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a goal name");
      return;
    }
    if (!targetMonth) {
      setError("Choose a target date");
      return;
    }

    let resolvedTargetAmount: number;
    let resolvedStartingBalance: number | null = null;
    let resolvedMonthlyPayment: number | null = null;

    if (type === "debt") {
      const balance = Number(startingBalance);
      const payment = Number(monthlyPayment);
      if (!startingBalance.trim() || Number.isNaN(balance) || balance <= 0) {
        setError("Enter a valid starting balance");
        return;
      }
      if (!monthlyPayment.trim() || Number.isNaN(payment) || payment <= 0) {
        setError("Enter a valid monthly payment");
        return;
      }
      resolvedTargetAmount = balance;
      resolvedStartingBalance = balance;
      resolvedMonthlyPayment = payment;
    } else {
      const amount = Number(targetAmount);
      if (!targetAmount.trim() || Number.isNaN(amount) || amount <= 0) {
        setError("Enter a valid target amount");
        return;
      }
      if (needsCategory && !categoryName) {
        setError("Choose a category to link");
        return;
      }
      resolvedTargetAmount = amount;
    }

    await onSubmit({
      name: trimmedName,
      type,
      targetAmount: resolvedTargetAmount,
      targetDate: monthInputToDate(targetMonth),
      category: needsCategory ? categoryName : null,
      startingBalance: resolvedStartingBalance,
      monthlyPayment: resolvedMonthlyPayment,
      colour,
      emoji,
      notes: notes.trim() || null,
    });
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={isEditing ? `Edit ${goal.name}` : "New goal"}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="submit"
            form="goal-form"
            disabled={isSaving}
            className="min-h-[44px] rounded-md bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : isEditing ? "Save changes" : "Create goal"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
          >
            Cancel
          </button>
        </div>
      }
    >
      <form id="goal-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="goal-name" className="text-sm font-medium">
            Goal name
          </label>
          <input
            id="goal-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. House deposit"
            autoFocus
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Goal type</span>
          <div className="flex rounded-md border border-black/10 p-0.5 dark:border-white/10">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={isEditing}
                  onClick={() => setType(option.value)}
                  className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    type === option.value
                      ? "bg-blue-600 text-white"
                      : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {type === "debt" ? (
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="goal-starting-balance" className="text-sm font-medium">
                Starting balance
              </label>
              <input
                id="goal-starting-balance"
                type="number"
                min="0"
                step="0.01"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                placeholder="0.00"
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label htmlFor="goal-monthly-payment" className="text-sm font-medium">
                Monthly payment
              </label>
              <input
                id="goal-monthly-payment"
                type="number"
                min="0"
                step="0.01"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                placeholder="0.00"
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-target-amount" className="text-sm font-medium">
              {type === "spending" ? "Monthly spending limit" : "Target amount"}
            </label>
            <input
              id="goal-target-amount"
              type="number"
              min="0"
              step="0.01"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="0.00"
              className="w-40 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            />
          </div>
        )}

        {needsCategory && (
          <div className="flex flex-col gap-1">
            <label htmlFor="goal-category" className="text-sm font-medium">
              Linked category
            </label>
            <select
              id="goal-category"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {type === "savings"
                ? "Progress is tracked automatically from this category's transactions."
                : "Spending in this category this month is tracked automatically."}
            </p>

            {isAddingCategory ? (
              <div className="mt-1 flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10">
                <div className="flex flex-col gap-1">
                  <label htmlFor="goal-new-category-name" className="text-xs font-medium">
                    Category name
                  </label>
                  <input
                    id="goal-new-category-name"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Transfers to Savings"
                    autoFocus
                    className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="goal-new-category-parent" className="text-xs font-medium">
                    Parent category
                  </label>
                  <select
                    id="goal-new-category-parent"
                    value={newCategoryParent}
                    onChange={(e) => setNewCategoryParent(e.target.value)}
                    className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                  >
                    {PARENT_CATEGORIES.map((parent) => (
                      <option key={parent} value={parent}>
                        {parent}
                      </option>
                    ))}
                  </select>
                </div>
                {newCategoryError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{newCategoryError}</p>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveNewCategory}
                    disabled={isSavingCategory || !newCategoryName.trim()}
                    className="min-h-[36px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSavingCategory ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAddCategory}
                    disabled={isSavingCategory}
                    className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleOpenAddCategory}
                className="mt-1 flex w-fit items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Create new category
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="goal-target-month" className="text-sm font-medium">
            {type === "spending" ? "Tracking month" : type === "debt" ? "Payoff by" : "Target date"}
          </label>
          <input
            id="goal-target-month"
            type="month"
            value={targetMonth}
            onChange={(e) => setTargetMonth(e.target.value)}
            className="w-40 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="goal-notes" className="text-sm font-medium">
            Notes <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional)</span>
          </label>
          <textarea
            id="goal-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="resize-none rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Colour</span>
          <div className="flex flex-wrap items-center gap-2">
            {GOAL_COLOUR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColour(option)}
                aria-label={`Colour ${option}`}
                className="h-7 w-7 shrink-0 rounded-full transition-transform"
                style={{
                  backgroundColor: option,
                  transform: colour === option ? "scale(1.15)" : undefined,
                  boxShadow: colour === option ? `0 0 0 2px var(--background), 0 0 0 4px ${option}` : undefined,
                }}
              />
            ))}
            <input
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              aria-label="Custom colour"
              className="h-7 w-9 cursor-pointer rounded-md border border-black/10 bg-transparent p-0.5 dark:border-white/10"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Icon</span>
          <div className="grid grid-cols-8 gap-1.5 rounded-md border border-black/10 p-2 dark:border-white/10">
            {GOAL_EMOJI_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEmoji(option)}
                aria-label={`Icon ${option}`}
                className={`flex h-9 w-9 items-center justify-center rounded-md text-lg transition-colors ${
                  emoji === option ? "bg-blue-100 dark:bg-blue-500/20" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>
    </BottomSheet>
  );
}
