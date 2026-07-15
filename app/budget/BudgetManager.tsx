"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Copy,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useBudgets, type Budget } from "../context/BudgetsContext";
import { useCategories, type Category } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import { orderByParentPriority } from "../lib/categories";
import { formatPeriodLabel, getMonthRange } from "../lib/period";
import { calculatePace, getCurrentMonthKey, progressBarColour, shiftMonthKey } from "../lib/budgets";
import Sparkline from "./Sparkline";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type AddMode = "single" | "group";

// A single category budget and a budget group are rendered as the same kind
// of card — this is the shape both get normalized into so the list can be
// sorted and rendered uniformly regardless of which one a row actually is.
type CardItem = {
  kind: "single" | "group";
  id: string; // budget id or budget group id
  name: string;
  categories: Category[];
  amount: number;
  spent: number;
  percent: number;
};

export default function BudgetManager() {
  const {
    budgets,
    budgetGroups,
    isLoading: budgetsLoading,
    upsertBudget,
    deleteBudget,
    addBudgetGroup,
    updateBudgetGroupAmount,
    deleteBudgetGroup,
  } = useBudgets();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { transactions } = useTransactions();

  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey());

  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("single");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupCategoryIds, setNewGroupCategoryIds] = useState<string[]>([]);
  const [newAmount, setNewAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [isSavingNew, setIsSavingNew] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Progress bars animate in from 0 whenever the visible month's data
  // changes, rather than snapping straight to their target width.
  const [barsReady, setBarsReady] = useState(false);
  useEffect(() => {
    setBarsReady(false);
    const raf = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(raf);
  }, [monthKey]);

  const monthRange = useMemo(() => getMonthRange(monthKey), [monthKey]);
  const isCurrentMonth = monthKey === getCurrentMonthKey();
  const lastMonthKey = useMemo(() => shiftMonthKey(monthKey, -1), [monthKey]);
  // The three months (oldest to newest) shown in each card's trend sparkline.
  const sparklineMonths = useMemo(
    () => [shiftMonthKey(monthKey, -2), shiftMonthKey(monthKey, -1), monthKey],
    [monthKey]
  );

  // The 11 core categories (always present) plus any custom ones, in the
  // same fixed display order used everywhere else in the app.
  const orderedCategories = useMemo(() => {
    const order = orderByParentPriority(categories.map((c) => c.name));
    const byName = new Map(categories.map((c) => [c.name, c]));
    return order.map((name) => byName.get(name)).filter((c): c is Category => !!c);
  }, [categories]);
  const categoryByName = useMemo(
    () => new Map(categories.map((c) => [c.name.toLowerCase(), c])),
    [categories]
  );

  // Spend per category, per month, for every month a sparkline needs — built
  // once so each card just looks up its slice instead of re-scanning every
  // transaction.
  const spentByCategoryByMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const m of sparklineMonths) map.set(m, new Map());
    const monthSet = new Set(sparklineMonths);

    for (const t of transactions) {
      if (t.amount >= 0 || t.isOneOff) continue;
      const m = t.date.slice(0, 7);
      if (!monthSet.has(m)) continue;
      const catMap = map.get(m)!;
      const key = t.category.toLowerCase();
      catMap.set(key, (catMap.get(key) ?? 0) + Math.abs(t.amount));
    }
    return map;
  }, [transactions, sparklineMonths]);

  const spentByCategory = spentByCategoryByMonth.get(monthKey) ?? new Map<string, number>();

  const monthlyIncome = useMemo(() => {
    let income = 0;
    for (const t of transactions) {
      if (t.isOneOff || t.amount <= 0) continue;
      if (t.date < monthRange.from || t.date > monthRange.to) continue;
      income += t.amount;
    }
    return income;
  }, [transactions, monthRange]);

  const budgetByCategory = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const b of budgets) {
      if (b.month === monthKey) map.set(b.category.toLowerCase(), b);
    }
    return map;
  }, [budgets, monthKey]);

  const thisMonthGroups = useMemo(
    () => budgetGroups.filter((g) => g.month === monthKey),
    [budgetGroups, monthKey]
  );

  // Every category name already spoken for this month, whether by a single
  // budget or as part of a group — a category can only belong to one of
  // either per month, so this is what keeps the add/group-select lists from
  // offering it twice.
  const claimedCategoryNames = useMemo(() => {
    const set = new Set<string>();
    for (const key of budgetByCategory.keys()) set.add(key);
    for (const group of thisMonthGroups) {
      for (const name of group.categories) set.add(name.toLowerCase());
    }
    return set;
  }, [budgetByCategory, thisMonthGroups]);

  const availableCategories = useMemo(
    () => orderedCategories.filter((c) => !claimedCategoryNames.has(c.name.toLowerCase())),
    [orderedCategories, claimedCategoryNames]
  );

  const lastMonthHasBudgets = useMemo(
    () =>
      budgets.some((b) => b.month === lastMonthKey) ||
      budgetGroups.some((g) => g.month === lastMonthKey),
    [budgets, budgetGroups, lastMonthKey]
  );

  function spentForCategories(cardCategories: Category[], month: string): number {
    const catMap = spentByCategoryByMonth.get(month);
    if (!catMap) return 0;
    return cardCategories.reduce((sum, c) => sum + (catMap.get(c.name.toLowerCase()) ?? 0), 0);
  }

  // Single budgets and groups normalized into one sortable, renderable list.
  // Built from saved amounts only (never the live edit draft) so a card
  // never jumps position while its amount is mid-edit.
  const cardItems = useMemo<CardItem[]>(() => {
    const items: CardItem[] = [];

    for (const category of orderedCategories) {
      const budget = budgetByCategory.get(category.name.toLowerCase());
      if (!budget) continue;
      const spent = spentByCategory.get(category.name.toLowerCase()) ?? 0;
      items.push({
        kind: "single",
        id: budget.id,
        name: category.name,
        categories: [category],
        amount: budget.amount,
        spent,
        percent: budget.amount > 0 ? (spent / budget.amount) * 100 : 0,
      });
    }

    for (const group of thisMonthGroups) {
      const groupCategories = group.categories
        .map((name) => categoryByName.get(name.toLowerCase()))
        .filter((c): c is Category => !!c);
      const spent = spentForCategories(groupCategories, monthKey);
      items.push({
        kind: "group",
        id: group.id,
        name: group.name,
        categories: groupCategories,
        amount: group.amount,
        spent,
        percent: group.amount > 0 ? (spent / group.amount) * 100 : 0,
      });
    }

    return items.sort((a, b) => b.percent - a.percent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCategories, budgetByCategory, spentByCategory, thisMonthGroups, categoryByName, monthKey]);

  const totals = useMemo(() => {
    let budgeted = 0;
    let spent = 0;
    for (const item of cardItems) {
      budgeted += item.amount;
      spent += item.spent;
    }
    return { budgeted, spent };
  }, [cardItems]);

  const unbudgeted = monthlyIncome - totals.budgeted;

  function clearActionError(id: string) {
    setActionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function handleOpenAdd() {
    setIsAdding(true);
    setAddMode("single");
    setNewCategoryId(availableCategories[0]?.id ?? "");
    setNewGroupName("");
    setNewGroupCategoryIds([]);
    setNewAmount("");
    setAddError(null);
  }

  function handleCancelAdd() {
    setIsAdding(false);
    setAddMode("single");
    setNewCategoryId("");
    setNewGroupName("");
    setNewGroupCategoryIds([]);
    setNewAmount("");
    setAddError(null);
  }

  // "N" opens the add-budget form, unless the user is typing somewhere or
  // the form is already open.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isAdding) return;
      if (event.key.toLowerCase() !== "n") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;

      event.preventDefault();
      handleOpenAdd();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function toggleGroupCategory(categoryId: string) {
    setNewGroupCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAddSubmit(event: React.FormEvent) {
    event.preventDefault();
    setAddError(null);

    const amount = Number(newAmount);
    if (!newAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setAddError("Enter a valid amount");
      return;
    }

    if (addMode === "single") {
      const category = availableCategories.find((c) => c.id === newCategoryId);
      if (!category) {
        setAddError("Choose a category");
        return;
      }

      setIsSavingNew(true);
      try {
        await upsertBudget(category.name, monthKey, amount);
        handleCancelAdd();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Failed to save budget");
      } finally {
        setIsSavingNew(false);
      }
      return;
    }

    const trimmedName = newGroupName.trim();
    const selectedCategories = availableCategories.filter((c) => newGroupCategoryIds.includes(c.id));

    if (!trimmedName) {
      setAddError("Enter a group name");
      return;
    }
    if (selectedCategories.length === 0) {
      setAddError("Select at least one category");
      return;
    }

    setIsSavingNew(true);
    try {
      await addBudgetGroup(
        trimmedName,
        monthKey,
        amount,
        selectedCategories.map((c) => c.name)
      );
      handleCancelAdd();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create budget group");
    } finally {
      setIsSavingNew(false);
    }
  }

  function handleStartEdit(item: CardItem) {
    setEditingId(item.id);
    setEditAmount(String(item.amount));
    clearActionError(item.id);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditAmount("");
  }

  async function handleSaveEdit(item: CardItem) {
    const amount = Number(editAmount);
    if (!editAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setActionErrors((prev) => ({ ...prev, [item.id]: "Enter a valid amount" }));
      return;
    }

    setIsSavingEdit(true);
    clearActionError(item.id);
    try {
      if (item.kind === "single") {
        await upsertBudget(item.name, monthKey, amount);
      } else {
        await updateBudgetGroupAmount(item.id, amount);
      }
      handleCancelEdit();
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : "Failed to save budget",
      }));
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(item: CardItem) {
    const noun = item.kind === "group" ? "budget group" : "budget";
    const confirmed = window.confirm(`Remove the ${noun} for ${item.name}?`);
    if (!confirmed) return;

    setDeletingId(item.id);
    clearActionError(item.id);
    try {
      if (item.kind === "single") await deleteBudget(item.id);
      else await deleteBudgetGroup(item.id);
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : `Failed to delete ${noun}`,
      }));
    } finally {
      setDeletingId(null);
    }
  }

  // Copies every single budget and group from last month that isn't already
  // present this month — categories already claimed this month (by a budget
  // or a group) are left untouched rather than clobbered or duplicated.
  async function handleCopyFromLastMonth() {
    const singleTargets = budgets.filter(
      (b) => b.month === lastMonthKey && !claimedCategoryNames.has(b.category.toLowerCase())
    );
    const groupTargets = budgetGroups.filter(
      (g) =>
        g.month === lastMonthKey &&
        !thisMonthGroups.some((existing) => existing.name.toLowerCase() === g.name.toLowerCase()) &&
        g.categories.every((name) => !claimedCategoryNames.has(name.toLowerCase()))
    );
    if (singleTargets.length === 0 && groupTargets.length === 0) return;

    setIsCopying(true);
    clearActionError("copy");
    try {
      for (const target of singleTargets) {
        await upsertBudget(target.category, monthKey, target.amount);
      }
      for (const target of groupTargets) {
        await addBudgetGroup(target.name, monthKey, target.amount, target.categories);
      }
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        copy: err instanceof Error ? err.message : "Failed to copy last month's budgets",
      }));
    } finally {
      setIsCopying(false);
    }
  }

  const isLoading = budgetsLoading || categoriesLoading;
  const showEmptyState = !isLoading && cardItems.length === 0 && !isAdding;

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthKey((prev) => shiftMonthKey(prev, -1))}
            aria-label="Previous month"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[9rem] text-center text-base font-semibold">
            {formatPeriodLabel(monthRange)}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey((prev) => shiftMonthKey(prev, 1))}
            aria-label="Next month"
            className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {!isAdding && !showEmptyState && (
          <div className="flex items-center gap-2">
            {lastMonthHasBudgets && (
              <button
                type="button"
                onClick={handleCopyFromLastMonth}
                disabled={isCopying}
                className="flex items-center gap-1.5 rounded-md border border-black/10 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                <Copy className="h-4 w-4" />
                {isCopying ? "Copying…" : "Copy from last month"}
              </button>
            )}
            {availableCategories.length > 0 && (
              <button
                type="button"
                onClick={handleOpenAdd}
                title="Press N to add a budget"
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add budget
              </button>
            )}
          </div>
        )}
      </div>

      {!isLoading && monthlyIncome > 0 && unbudgeted > 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          You have{" "}
          <span className="font-medium text-zinc-900 dark:text-white">
            {currencyFormatter.format(unbudgeted)}
          </span>{" "}
          unbudgeted this month based on your income.
        </p>
      )}

      {actionErrors.copy && (
        <p className="text-sm text-red-600 dark:text-red-400">{actionErrors.copy}</p>
      )}

      {isLoading ? (
        <p className="rounded-lg border border-black/10 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Loading budgets…
        </p>
      ) : (
        <>
          {isAdding && (
            <form
              onSubmit={handleAddSubmit}
              className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
            >
              <div className="flex rounded-md border border-black/10 p-0.5 dark:border-white/10 w-fit">
                {(["single", "group"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAddMode(mode)}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                      addMode === mode
                        ? "bg-blue-600 text-white"
                        : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                    }`}
                  >
                    {mode === "single" ? "Single category" : "Category group"}
                  </button>
                ))}
              </div>

              {addMode === "single" ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="new-budget-category" className="text-sm font-medium">
                      Category
                    </label>
                    <select
                      id="new-budget-category"
                      value={newCategoryId}
                      onChange={(e) => setNewCategoryId(e.target.value)}
                      className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                    >
                      {availableCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label htmlFor="new-budget-amount" className="text-sm font-medium">
                      Amount
                    </label>
                    <input
                      id="new-budget-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newAmount}
                      onChange={(e) => setNewAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-32 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingNew || !newCategoryId || !newAmount.trim()}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSavingNew ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAdd}
                    disabled={isSavingNew}
                    className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="new-group-name" className="text-sm font-medium">
                        Group name
                      </label>
                      <input
                        id="new-group-name"
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="e.g. Food & Dining"
                        className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="new-group-amount" className="text-sm font-medium">
                        Amount
                      </label>
                      <input
                        id="new-group-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newAmount}
                        onChange={(e) => setNewAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-32 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">Categories</span>
                    {availableCategories.length === 0 ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Every category already has a budget this month.
                      </p>
                    ) : (
                      <div className="grid max-h-48 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-black/10 p-3 sm:grid-cols-3 dark:border-white/10">
                        {availableCategories.map((category) => (
                          <label
                            key={category.id}
                            className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <input
                              type="checkbox"
                              checked={newGroupCategoryIds.includes(category.id)}
                              onChange={() => toggleGroupCategory(category.id)}
                              className="h-3.5 w-3.5 accent-blue-600"
                            />
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: category.colour }}
                            />
                            {category.name}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isSavingNew || !newGroupName.trim() || newGroupCategoryIds.length === 0}
                      className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingNew ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAdd}
                      disabled={isSavingNew}
                      className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {addError && <p className="text-sm text-red-600 dark:text-red-400">{addError}</p>}
            </form>
          )}

          {showEmptyState ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-black/10 p-10 text-center dark:border-white/10">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                <PiggyBank className="h-7 w-7" />
              </div>
              <p className="text-sm font-medium">No budgets set for {formatPeriodLabel(monthRange)}</p>
              <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                Add a budget for a category, or bundle a few together as a group, to start tracking
                your spending against it.
              </p>
              <button
                type="button"
                onClick={handleOpenAdd}
                className="mt-1 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add budget
              </button>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">Tip: press N to add one quickly.</p>
            </div>
          ) : (
            cardItems.length > 0 && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Budgeted</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {currencyFormatter.format(totals.budgeted)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Spent</p>
                    <p
                      className={`mt-1 text-2xl font-semibold ${
                        totals.budgeted > 0 && totals.spent > totals.budgeted
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }`}
                    >
                      {currencyFormatter.format(totals.spent)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {cardItems.map((item) => {
                    const isEditing = editingId === item.id;
                    const isExpanded = expandedIds.has(item.id);

                    const effectiveAmount = isEditing ? Number(editAmount) || 0 : item.amount;
                    const percent = effectiveAmount > 0 ? (item.spent / effectiveAmount) * 100 : 0;
                    const remaining = effectiveAmount - item.spent;
                    const pace = isCurrentMonth ? calculatePace(item.spent, item.amount, monthKey) : null;
                    const sparklineValues = sparklineMonths.map((m) => spentForCategories(item.categories, m));

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-black/10 p-4 dark:border-white/10"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {item.kind === "group" ? (
                              <div className="flex -space-x-1.5">
                                {item.categories.slice(0, 5).map((c) => (
                                  <span
                                    key={c.id}
                                    title={c.name}
                                    className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-background"
                                    style={{ backgroundColor: c.colour }}
                                  />
                                ))}
                                {item.categories.length > 5 && (
                                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-[8px] font-medium text-zinc-700 ring-2 ring-background dark:bg-zinc-600 dark:text-zinc-200">
                                    +{item.categories.length - 5}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: item.categories[0]?.colour }}
                              />
                            )}
                            <span className="font-medium">{item.name}</span>
                            {item.kind === "group" && (
                              <button
                                type="button"
                                onClick={() => toggleExpanded(item.id)}
                                aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                                aria-expanded={isExpanded}
                                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <Sparkline values={sparklineValues} />

                            {!isEditing && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(item)}
                                  aria-label={`Edit budget for ${item.name}`}
                                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(item)}
                                  disabled={deletingId === item.id}
                                  aria-label={`Delete budget for ${item.name}`}
                                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-3 flex flex-wrap items-end gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Amount
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                autoFocus
                                className="w-32 rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(item)}
                              disabled={isSavingEdit || !editAmount.trim()}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSavingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={isSavingEdit}
                              className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="mt-3 flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                                <div
                                  className={`h-full rounded-full transition-[width] duration-700 ease-out ${progressBarColour(percent)}`}
                                  style={{ width: `${barsReady ? Math.min(percent, 100) : 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                {Math.round(percent)}%
                              </span>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                                {currencyFormatter.format(item.spent)} of{" "}
                                {currencyFormatter.format(item.amount)} spent
                              </span>

                              <div className="flex items-center gap-3">
                                <span
                                  className={
                                    remaining < 0
                                      ? "text-sm font-medium text-red-600 dark:text-red-400"
                                      : "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                                  }
                                >
                                  {remaining < 0
                                    ? `Overspent by ${currencyFormatter.format(Math.abs(remaining))}`
                                    : `${currencyFormatter.format(remaining)} remaining`}
                                </span>

                                {pace && (
                                  <span
                                    className={`flex items-center gap-1 text-xs ${
                                      pace === "atRisk"
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    }`}
                                  >
                                    {pace === "atRisk" ? (
                                      <TriangleAlert className="h-3 w-3" />
                                    ) : (
                                      <CircleCheck className="h-3 w-3" />
                                    )}
                                    {pace === "atRisk" ? "At risk" : "On track"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        {item.kind === "group" && isExpanded && (
                          <div className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
                            {[...item.categories]
                              .sort(
                                (a, b) =>
                                  (spentByCategory.get(b.name.toLowerCase()) ?? 0) -
                                  (spentByCategory.get(a.name.toLowerCase()) ?? 0)
                              )
                              .map((category) => (
                                <div
                                  key={category.id}
                                  className="flex items-center justify-between gap-2 text-sm"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: category.colour }}
                                    />
                                    <span className="text-zinc-700 dark:text-zinc-300">
                                      {category.name}
                                    </span>
                                  </div>
                                  <span className="text-zinc-500 dark:text-zinc-400">
                                    {currencyFormatter.format(
                                      spentByCategory.get(category.name.toLowerCase()) ?? 0
                                    )}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}

                        {actionErrors[item.id] && (
                          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                            {actionErrors[item.id]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
