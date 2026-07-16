"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleCheck, PiggyBank, Plus, TriangleAlert, X } from "lucide-react";
import { useAnnualBudgets } from "../context/AnnualBudgetsContext";
import { useCategories, type Category } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import { useSettings } from "../context/SettingsContext";
import { orderByParentPriority } from "../lib/categories";
import {
  calculateAnnualPace,
  formatYearLabel,
  getCurrentYearKey,
  getYearRange,
  monthsElapsedInYear,
  monthsInYear,
  projectedYearEndSpend,
  shiftYearKey,
} from "../lib/annualBudgets";
import { sortCardItems, SORT_OPTIONS, type SortOption } from "../lib/budgetSort";
import {
  buildTransactionsHref,
  CATEGORIES_FILTER_PREFIX,
  CATEGORY_FILTER_PREFIX,
} from "../transactions/TransactionFilters";
import DrillDownPanel, { type DrillDownData } from "../components/charts/DrillDownPanel";
import BudgetCard from "./BudgetCard";
import FloatingAddButton from "./FloatingAddButton";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type AddMode = "single" | "group";

// A single-category annual budget and an annual budget group are rendered as
// the same kind of card — mirrors CardItem in BudgetManager.tsx.
type CardItem = {
  kind: "single" | "group";
  id: string;
  name: string;
  categories: Category[];
  amount: number;
  spentYTD: number;
  percent: number;
  monthlyValues: number[]; // Jan..Dec spend for the sparkline
};

// Per-card entrance stagger — kept short so a full grid doesn't take long to
// finish settling in.
const CARD_STAGGER_MS = 40;

export default function AnnualBudgetManager() {
  const {
    annualBudgets,
    isLoading: annualBudgetsLoading,
    upsertAnnualBudget,
    addAnnualBudgetGroup,
    updateAnnualBudgetAmount,
    deleteAnnualBudget,
  } = useAnnualBudgets();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { transactions } = useTransactions();
  const { financialYearPreference: fyPreference } = useSettings();
  const isLoading = annualBudgetsLoading || categoriesLoading;

  const [yearKey, setYearKey] = useState(() => getCurrentYearKey(new Date(), fyPreference));
  const [sortOption, setSortOption] = useState<SortOption>("percentDesc");

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
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [carryForwardNotice, setCarryForwardNotice] = useState<{
    year: string;
    fromLabel: string;
  } | null>(null);
  // Years already checked for carry-forward this session — keyed on yearKey
  // change (navigation), not on every annualBudgets mutation, so deleting a
  // carried-forward budget doesn't get silently re-created. Mirrors
  // BudgetManager.tsx's monthly carryForwardChecked guard.
  const carryForwardChecked = useRef<Set<string>>(new Set());

  // Progress meters animate in from 0 whenever the visible year's data
  // changes, rather than snapping straight to their target fill.
  const [barsReady, setBarsReady] = useState(false);
  useEffect(() => {
    setBarsReady(false);
    const raf = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(raf);
  }, [yearKey]);

  const yearRange = useMemo(() => getYearRange(yearKey, fyPreference), [yearKey, fyPreference]);
  const yearMonths = useMemo(() => monthsInYear(yearKey, fyPreference), [yearKey, fyPreference]);
  const isCurrentYear = yearKey === getCurrentYearKey(new Date(), fyPreference);
  const monthsElapsed = monthsElapsedInYear(yearKey, new Date(), fyPreference);
  const monthsRemaining = Math.max(0, 12 - monthsElapsed);

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

  // Spend per category, per month, across every month of the visible year —
  // built once so each card just looks up its slice instead of re-scanning
  // every transaction.
  const spentByCategoryByMonth = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const m of yearMonths) map.set(m, new Map());
    const monthSet = new Set(yearMonths);

    for (const t of transactions) {
      if (t.amount >= 0 || t.isOneOff) continue;
      const m = t.date.slice(0, 7);
      if (!monthSet.has(m)) continue;
      const catMap = map.get(m)!;
      const key = t.category.toLowerCase();
      catMap.set(key, (catMap.get(key) ?? 0) + Math.abs(t.amount));
    }
    return map;
  }, [transactions, yearMonths]);

  function spentForCategoriesInMonth(cardCategories: Category[], month: string): number {
    const catMap = spentByCategoryByMonth.get(month);
    if (!catMap) return 0;
    return cardCategories.reduce((sum, c) => sum + (catMap.get(c.name.toLowerCase()) ?? 0), 0);
  }

  const thisYearBudgets = useMemo(
    () => annualBudgets.filter((b) => b.year === yearKey && !b.isGroup),
    [annualBudgets, yearKey]
  );
  const thisYearGroups = useMemo(
    () => annualBudgets.filter((b) => b.year === yearKey && b.isGroup),
    [annualBudgets, yearKey]
  );

  // Every category name already spoken for this year, whether by a single
  // annual budget or as part of a group — keeps the add/group-select lists
  // from offering it twice.
  const claimedCategoryNames = useMemo(() => {
    const set = new Set<string>();
    for (const b of thisYearBudgets) {
      if (b.category) set.add(b.category.toLowerCase());
    }
    for (const g of thisYearGroups) {
      for (const name of g.groupCategories ?? []) set.add(name.toLowerCase());
    }
    return set;
  }, [thisYearBudgets, thisYearGroups]);

  const availableCategories = useMemo(
    () => orderedCategories.filter((c) => !claimedCategoryNames.has(c.name.toLowerCase())),
    [orderedCategories, claimedCategoryNames]
  );

  // Silently carries annual budgets forward from the most recent earlier
  // year that had any, whenever navigation lands on a year with none of its
  // own — the annual analogue of BudgetManager.tsx's monthly carry-forward.
  // Runs once per yearKey (the `carryForwardChecked` guard, not the effect's
  // dependency array, is what prevents it firing again after this same year
  // later goes back to empty because the user deleted what got carried in).
  useEffect(() => {
    if (isLoading) return;
    if (carryForwardChecked.current.has(yearKey)) return;
    carryForwardChecked.current.add(yearKey);

    const hasOwnBudgets = annualBudgets.some((b) => b.year === yearKey);
    if (hasOwnBudgets) return;

    const priorYears = new Set<string>();
    for (const b of annualBudgets) {
      if (b.year < yearKey) priorYears.add(b.year);
    }
    if (priorYears.size === 0) return;
    const sourceYear = [...priorYears].sort().at(-1)!;

    const sourceBudgets = annualBudgets.filter((b) => b.year === sourceYear && !b.isGroup);
    const sourceGroups = annualBudgets.filter((b) => b.year === sourceYear && b.isGroup);
    const targetYear = yearKey;

    (async () => {
      try {
        for (const target of sourceBudgets) {
          if (!target.category) continue;
          await upsertAnnualBudget(target.category, targetYear, target.amount);
        }
        for (const target of sourceGroups) {
          if (!target.groupName || !target.groupCategories) continue;
          await addAnnualBudgetGroup(target.groupName, targetYear, target.amount, target.groupCategories);
        }
        setCarryForwardNotice({
          year: targetYear,
          fromLabel: formatYearLabel(sourceYear, fyPreference),
        });
      } catch {
        // Silent by design — carry-forward is a background convenience, so a
        // failure just leaves the year empty for the user to fill in by hand.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearKey, isLoading]);

  // Single annual budgets and groups normalized into one sortable,
  // renderable list — mirrors BudgetManager's cardItems.
  const cardItems = useMemo<CardItem[]>(() => {
    const items: CardItem[] = [];

    for (const budget of thisYearBudgets) {
      const category = budget.category ? categoryByName.get(budget.category.toLowerCase()) : undefined;
      if (!category) continue;
      const monthlyValues = yearMonths.map((m) => spentForCategoriesInMonth([category], m));
      const spentYTD = monthlyValues.reduce((sum, v) => sum + v, 0);
      items.push({
        kind: "single",
        id: budget.id,
        name: category.name,
        categories: [category],
        amount: budget.amount,
        spentYTD,
        percent: budget.amount > 0 ? (spentYTD / budget.amount) * 100 : 0,
        monthlyValues,
      });
    }

    for (const group of thisYearGroups) {
      const groupCategories = (group.groupCategories ?? [])
        .map((name) => categoryByName.get(name.toLowerCase()))
        .filter((c): c is Category => !!c);
      const monthlyValues = yearMonths.map((m) => spentForCategoriesInMonth(groupCategories, m));
      const spentYTD = monthlyValues.reduce((sum, v) => sum + v, 0);
      items.push({
        kind: "group",
        id: group.id,
        name: group.groupName ?? "",
        categories: groupCategories,
        amount: group.amount,
        spentYTD,
        percent: group.amount > 0 ? (spentYTD / group.amount) * 100 : 0,
        monthlyValues,
      });
    }

    return sortCardItems(items, sortOption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thisYearBudgets, thisYearGroups, categoryByName, yearMonths, spentByCategoryByMonth, sortOption]);

  const totals = useMemo(() => {
    let budgeted = 0;
    let spent = 0;
    for (const item of cardItems) {
      budgeted += item.amount;
      spent += item.spentYTD;
    }
    return { budgeted, spent };
  }, [cardItems]);

  const projectedTotal = projectedYearEndSpend(totals.spent, yearKey, new Date(), fyPreference);
  const overallPace = calculateAnnualPace(totals.spent, totals.budgeted, yearKey, new Date(), fyPreference);

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

  // Matches the same set of transactions the card's "spent" figure is built
  // from — negative, non-one-off amounts anywhere in the visible year — so
  // the drill-down total lines up with the card.
  function openDrillDown(item: CardItem) {
    const categoryNames = new Set(item.categories.map((c) => c.name.toLowerCase()));
    const matches = transactions.filter(
      (t) =>
        !t.isOneOff &&
        t.amount < 0 &&
        t.date >= yearRange.from &&
        t.date <= yearRange.to &&
        categoryNames.has(t.category.toLowerCase())
    );

    const categoryFilter =
      item.kind === "single"
        ? `${CATEGORY_FILTER_PREFIX}${item.categories[0].name}`
        : `${CATEGORIES_FILTER_PREFIX}${item.categories.map((c) => c.name).join(",")}`;

    setDrillDown({
      title: `${item.name} — ${formatYearLabel(yearKey, fyPreference)}`,
      transactions: matches,
      href: buildTransactionsHref({
        category: categoryFilter,
        dateFrom: yearRange.from,
        dateTo: yearRange.to,
      }),
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
        await upsertAnnualBudget(category.name, yearKey, amount);
        handleCancelAdd();
      } catch (err) {
        setAddError(err instanceof Error ? err.message : "Failed to save annual budget");
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
      await addAnnualBudgetGroup(
        trimmedName,
        yearKey,
        amount,
        selectedCategories.map((c) => c.name)
      );
      handleCancelAdd();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create annual budget group");
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
        await upsertAnnualBudget(item.name, yearKey, amount);
      } else {
        await updateAnnualBudgetAmount(item.id, amount);
      }
      handleCancelEdit();
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : "Failed to save annual budget",
      }));
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDelete(item: CardItem) {
    const noun = item.kind === "group" ? "annual budget group" : "annual budget";
    const confirmed = window.confirm(`Remove the ${noun} for ${item.name}?`);
    if (!confirmed) return;

    setDeletingId(item.id);
    clearActionError(item.id);
    try {
      await deleteAnnualBudget(item.id);
    } catch (err) {
      setActionErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : `Failed to delete ${noun}`,
      }));
    } finally {
      setDeletingId(null);
    }
  }

  const showEmptyState = !isLoading && cardItems.length === 0 && !isAdding;
  const showFab = !isLoading && !isAdding && !showEmptyState && availableCategories.length > 0;

  return (
    <>
      <div className="mt-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setYearKey((prev) => shiftYearKey(prev, -1))}
              aria-label="Previous year"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="min-w-[6rem] text-center text-base font-semibold">
              {formatYearLabel(yearKey, fyPreference)}
            </span>
            <button
              type="button"
              onClick={() => setYearKey((prev) => shiftYearKey(prev, 1))}
              aria-label="Next year"
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {!isAdding && !showEmptyState && cardItems.length > 0 && (
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              aria-label="Sort annual budgets"
              className="rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {carryForwardNotice && carryForwardNotice.year === yearKey && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <span>Annual budgets carried forward from {carryForwardNotice.fromLabel}</span>
            <button
              type="button"
              onClick={() => setCarryForwardNotice(null)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-blue-700 transition-colors hover:bg-blue-500/10 dark:text-blue-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="rounded-lg border border-black/10 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            Loading annual budgets…
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
                      <label htmlFor="new-annual-budget-category" className="text-sm font-medium">
                        Category
                      </label>
                      <select
                        id="new-annual-budget-category"
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
                      <label htmlFor="new-annual-budget-amount" className="text-sm font-medium">
                        Annual amount
                      </label>
                      <input
                        id="new-annual-budget-amount"
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
                        <label htmlFor="new-annual-group-name" className="text-sm font-medium">
                          Group name
                        </label>
                        <input
                          id="new-annual-group-name"
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="e.g. Food & Dining"
                          className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor="new-annual-group-amount" className="text-sm font-medium">
                          Annual amount
                        </label>
                        <input
                          id="new-annual-group-amount"
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
                          Every category already has an annual budget this year.
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
              <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 p-10 text-center dark:border-white/10">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                  <PiggyBank className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium">
                  No annual budgets set for {formatYearLabel(yearKey, fyPreference)}
                </p>
                <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                  Add an annual budget for a category, or bundle a few together as a group, to start
                  tracking your yearly spending against it.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAdd}
                  className="mt-1 flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Annual Budget
                </button>
              </div>
            ) : (
              cardItems.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Budgeted</p>
                      <p className="mt-1 text-2xl font-semibold">
                        {currencyFormatter.format(totals.budgeted)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Spent Year to Date</p>
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
                    <div className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Projected Year-End</p>
                      <p
                        className={`mt-1 text-2xl font-semibold ${
                          totals.budgeted > 0 && projectedTotal > totals.budgeted
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }`}
                      >
                        {currencyFormatter.format(projectedTotal)}
                      </p>
                    </div>
                    <div
                      className={`rounded-xl border p-4 ${
                        overallPace === "atRisk"
                          ? "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
                          : overallPace === "onTrack"
                            ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                            : "border-black/10 dark:border-white/10"
                      }`}
                    >
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Months Remaining</p>
                      <p className="mt-1 text-2xl font-semibold">{monthsRemaining}</p>
                    </div>
                  </div>

                  {overallPace && (
                    <span
                      className={`flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        overallPace === "atRisk"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                      }`}
                    >
                      {overallPace === "atRisk" ? (
                        <TriangleAlert className="h-3.5 w-3.5" />
                      ) : (
                        <CircleCheck className="h-3.5 w-3.5" />
                      )}
                      {overallPace === "atRisk"
                        ? "Projected to go over budget"
                        : "On track for the year"}
                    </span>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cardItems.map((item, index) => {
                      const isEditing = editingId === item.id;
                      const isExpanded = expandedIds.has(item.id);

                      const effectiveAmount = isEditing ? Number(editAmount) || 0 : item.amount;
                      const percent = effectiveAmount > 0 ? (item.spentYTD / effectiveAmount) * 100 : 0;
                      const remaining = effectiveAmount - item.spentYTD;
                      const pace = calculateAnnualPace(
                        item.spentYTD,
                        item.amount,
                        yearKey,
                        new Date(),
                        fyPreference
                      );
                      const avgMonthlySpent = monthsElapsed > 0 ? item.spentYTD / monthsElapsed : 0;
                      const avgMonthlyNeeded = item.amount / 12;
                      const itemProjected = projectedYearEndSpend(
                        item.spentYTD,
                        yearKey,
                        new Date(),
                        fyPreference
                      );

                      return (
                        <BudgetCard
                          key={item.id}
                          name={item.name}
                          isGroup={item.kind === "group"}
                          categories={item.categories}
                          percent={percent}
                          spent={item.spentYTD}
                          amount={item.amount}
                          remaining={remaining}
                          pace={pace}
                          sparklineValues={item.monthlyValues}
                          barsReady={barsReady}
                          animationDelayMs={index * CARD_STAGGER_MS}
                          isEditing={isEditing}
                          editAmount={editAmount}
                          onEditAmountChange={setEditAmount}
                          amountFieldLabel="Annual amount"
                          isSavingEdit={isSavingEdit}
                          onSaveEdit={() => handleSaveEdit(item)}
                          onCancelEdit={handleCancelEdit}
                          editAriaLabel={`Edit annual budget for ${item.name}`}
                          deleteAriaLabel={`Delete annual budget for ${item.name}`}
                          onStartEdit={() => handleStartEdit(item)}
                          onDelete={() => handleDelete(item)}
                          isDeleting={deletingId === item.id}
                          onClick={() => openDrillDown(item)}
                          onViewTransactions={() => openDrillDown(item)}
                          isExpandable={item.kind === "group"}
                          isExpanded={isExpanded}
                          expandAriaLabel={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                          onToggleExpand={() => toggleExpanded(item.id)}
                          expandedContent={
                            item.kind === "group" ? (
                              <div className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
                                {item.categories
                                  .map((category) => ({
                                    category,
                                    spentYTD: yearMonths.reduce(
                                      (sum, m) => sum + spentForCategoriesInMonth([category], m),
                                      0
                                    ),
                                  }))
                                  .sort((a, b) => b.spentYTD - a.spentYTD)
                                  .map(({ category, spentYTD }) => (
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
                                        {currencyFormatter.format(spentYTD)}
                                      </span>
                                    </div>
                                  ))}
                              </div>
                            ) : null
                          }
                          extraInfo={
                            <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                              {currencyFormatter.format(avgMonthlySpent)}/mo spent vs{" "}
                              {currencyFormatter.format(avgMonthlyNeeded)}/mo needed
                              {isCurrentYear && (
                                <> · projected {currencyFormatter.format(itemProjected)} by year-end</>
                              )}
                            </p>
                          }
                          actionError={actionErrors[item.id]}
                        />
                      );
                    })}
                  </div>
                </>
              )
            )}
          </>
        )}
      </div>

      {showFab && <FloatingAddButton label="Add Annual Budget" onClick={handleOpenAdd} />}

      {drillDown && <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />}
    </>
  );
}
