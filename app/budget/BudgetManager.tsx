"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, PiggyBank, Plus, X } from "lucide-react";
import { useBudgets, type Budget } from "../context/BudgetsContext";
import { useAnnualBudgets } from "../context/AnnualBudgetsContext";
import { useCategories, type Category } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import { useSettings } from "../context/SettingsContext";
import { orderByParentPriority } from "../lib/categories";
import { formatMonthLabel, formatPeriodLabel, getMonthRange } from "../lib/period";
import { calculatePace, getCurrentMonthKey, shiftMonthKey } from "../lib/budgets";
import { getYearKeyForMonth } from "../lib/annualBudgets";
import {
  ADD_BUDGET_PERIOD_TYPES,
  getWeekBounds,
  isMonthApplicable,
  nextDueDate,
  PERIOD_NOUN,
  PERIOD_TYPE_LABELS,
  upcomingApplicableMonths,
  weeksInMonth,
  type PeriodType,
} from "../lib/budgetPeriods";
import { sortCardItems, SORT_OPTIONS, type SortOption } from "../lib/budgetSort";
import {
  buildTransactionsHref,
  CATEGORIES_FILTER_PREFIX,
  CATEGORY_FILTER_PREFIX,
} from "../transactions/TransactionFilters";
import DrillDownPanel, { type DrillDownData } from "../components/charts/DrillDownPanel";
import BudgetCard from "./BudgetCard";
import BudgetSummaryRow from "./BudgetSummaryRow";
import FloatingAddButton from "./FloatingAddButton";

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
  // Single-kind only — groups stay plain-monthly, so these are always
  // undefined for a "group" item.
  periodType?: PeriodType;
  periodAmount?: number | null;
  // The underlying budget's own anchor month ("YYYY-MM") — distinct from
  // the currently-viewed monthKey once a recurring budget is shown on a
  // later applicable month. Edits must target this month, not monthKey,
  // or they'd create a second, conflicting anchor row instead of updating
  // the original.
  anchorMonth?: string;
};

// Per-card entrance stagger — kept short so a full grid doesn't take long to
// finish settling in.
const CARD_STAGGER_MS = 40;

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
  const { annualBudgets } = useAnnualBudgets();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const { transactions } = useTransactions();
  const { financialYearPreference: fyPreference } = useSettings();
  const isLoading = budgetsLoading || categoriesLoading;

  const [monthKey, setMonthKey] = useState(() => getCurrentMonthKey());
  const [sortOption, setSortOption] = useState<SortOption>("percentDesc");

  const [isAdding, setIsAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("single");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newPeriodType, setNewPeriodType] = useState<PeriodType>("monthly");
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
  const [drillDown, setDrillDown] = useState<DrillDownData | null>(null);
  const [carryForwardNotice, setCarryForwardNotice] = useState<{
    month: string;
    fromLabel: string;
  } | null>(null);
  // Months already checked for carry-forward this session — keyed on
  // monthKey change (navigation), not on every budgets/groups mutation, so
  // deleting a carried-forward budget doesn't get silently re-created.
  const carryForwardChecked = useRef<Set<string>>(new Set());

  // Progress meters animate in from 0 whenever the visible month's data
  // changes, rather than snapping straight to their target fill.
  const [barsReady, setBarsReady] = useState(false);
  useEffect(() => {
    setBarsReady(false);
    const raf = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(raf);
  }, [monthKey]);

  const monthRange = useMemo(() => getMonthRange(monthKey), [monthKey]);
  const isCurrentMonth = monthKey === getCurrentMonthKey();

  // Annual budget amount, divided by 12, per category/group name — for the
  // "Annual: $X/mo implied" comparison badge. Keyed by name rather than id
  // since a monthly budget and an annual budget for the same category are
  // unrelated rows that just happen to share a category/group name.
  const impliedMonthlyByName = useMemo(() => {
    const year = getYearKeyForMonth(monthKey, fyPreference);
    const map = new Map<string, number>();
    for (const b of annualBudgets) {
      if (b.year !== year) continue;
      const name = b.isGroup ? b.groupName : b.category;
      if (!name) continue;
      map.set(name.toLowerCase(), b.amount / 12);
    }
    return map;
  }, [annualBudgets, monthKey, fyPreference]);
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
      if (isMonthApplicable(b.month, b.periodType, monthKey)) map.set(b.category.toLowerCase(), b);
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

  // Recurring (non-monthly) budgets already auto-apply going forward on
  // their own cycle, independent of carry-forward/copy — so they don't
  // count toward "does last month have budgets to copy" here.
  const lastMonthHasBudgets = useMemo(
    () =>
      budgets.some((b) => b.periodType === "monthly" && b.month === lastMonthKey) ||
      budgetGroups.some((g) => g.month === lastMonthKey),
    [budgets, budgetGroups, lastMonthKey]
  );

  // Silently carries budgets forward from the most recent earlier month that
  // had any, whenever navigation lands on a month with none of its own.
  // Runs once per monthKey (the `carryForwardChecked` guard, not the effect's
  // dependency array, is what prevents it firing again after this same month
  // later goes back to empty because the user deleted what got carried in).
  useEffect(() => {
    if (isLoading) return;
    if (carryForwardChecked.current.has(monthKey)) return;
    carryForwardChecked.current.add(monthKey);

    // Only plain-monthly budgets count toward "does this month already have
    // its own budgets" — a recurring budget applicable here (but anchored
    // elsewhere) doesn't mean the user has filled in this month's other
    // categories yet.
    const hasOwnBudgets =
      budgets.some((b) => b.periodType === "monthly" && b.month === monthKey) ||
      budgetGroups.some((g) => g.month === monthKey);
    if (hasOwnBudgets) return;

    const priorMonths = new Set<string>();
    for (const b of budgets) {
      if (b.periodType === "monthly" && b.month < monthKey) priorMonths.add(b.month);
    }
    for (const g of budgetGroups) {
      if (g.month < monthKey) priorMonths.add(g.month);
    }
    if (priorMonths.size === 0) return;
    const sourceMonth = [...priorMonths].sort().at(-1)!;

    // Recurring budgets are excluded here too — they already auto-apply via
    // isMonthApplicable, so copying one forward would create a second,
    // conflicting anchor row rather than a useful duplicate.
    const sourceBudgets = budgets.filter((b) => b.periodType === "monthly" && b.month === sourceMonth);
    const sourceGroups = budgetGroups.filter((g) => g.month === sourceMonth);
    const targetMonth = monthKey;

    (async () => {
      try {
        for (const target of sourceBudgets) {
          await upsertBudget(target.category, targetMonth, target.amount);
        }
        for (const target of sourceGroups) {
          await addBudgetGroup(target.name, targetMonth, target.amount, target.categories);
        }
        setCarryForwardNotice({
          month: targetMonth,
          fromLabel: formatPeriodLabel(getMonthRange(sourceMonth)),
        });
      } catch {
        // Silent by design — carry-forward is a background convenience, so a
        // failure just leaves the month empty for the user to fill in by hand.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, isLoading]);

  function spentForCategories(cardCategories: Category[], month: string): number {
    const catMap = spentByCategoryByMonth.get(month);
    if (!catMap) return 0;
    return cardCategories.reduce((sum, c) => sum + (catMap.get(c.name.toLowerCase()) ?? 0), 0);
  }

  // Actual spend for arbitrary (non-month-aligned) date ranges — used by the
  // weekly period's "this week" figure and per-week breakdown, where the
  // range doesn't line up with spentByCategoryByMonth's month buckets.
  function spentInRange(cardCategories: Category[], range: { from: string; to: string }): number {
    const categoryNames = new Set(cardCategories.map((c) => c.name.toLowerCase()));
    let total = 0;
    for (const t of transactions) {
      if (t.amount >= 0 || t.isOneOff) continue;
      if (t.date < range.from || t.date > range.to) continue;
      if (!categoryNames.has(t.category.toLowerCase())) continue;
      total += Math.abs(t.amount);
    }
    return total;
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
        periodType: budget.periodType,
        periodAmount: budget.periodAmount,
        anchorMonth: budget.month,
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

    return sortCardItems(items, sortOption);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orderedCategories,
    budgetByCategory,
    spentByCategory,
    thisMonthGroups,
    categoryByName,
    monthKey,
    sortOption,
  ]);

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
    setNewPeriodType("monthly");
    setNewGroupName("");
    setNewGroupCategoryIds([]);
    setNewAmount("");
    setAddError(null);
  }

  function handleCancelAdd() {
    setIsAdding(false);
    setAddMode("single");
    setNewCategoryId("");
    setNewPeriodType("monthly");
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

  // Matches the same set of transactions the card's "spent" figure is built
  // from (spentForCategories/spentByCategory) — negative, non-one-off amounts
  // in the visible month — so the drill-down total lines up with the card.
  function openDrillDown(item: CardItem) {
    const categoryNames = new Set(item.categories.map((c) => c.name.toLowerCase()));
    const matches = transactions.filter(
      (t) =>
        !t.isOneOff &&
        t.amount < 0 &&
        t.date >= monthRange.from &&
        t.date <= monthRange.to &&
        categoryNames.has(t.category.toLowerCase())
    );

    const categoryFilter =
      item.kind === "single"
        ? `${CATEGORY_FILTER_PREFIX}${item.categories[0].name}`
        : `${CATEGORIES_FILTER_PREFIX}${item.categories.map((c) => c.name).join(",")}`;

    setDrillDown({
      title: `${item.name} — ${formatPeriodLabel(monthRange)}`,
      transactions: matches,
      href: buildTransactionsHref({
        category: categoryFilter,
        dateFrom: monthRange.from,
        dateTo: monthRange.to,
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
        if (newPeriodType === "monthly") {
          await upsertBudget(category.name, monthKey, amount);
        } else {
          await upsertBudget(category.name, monthKey, amount, {
            type: newPeriodType,
            periodAmount: amount,
          });
        }
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
    // For a recurring budget, edit the raw per-period figure the user
    // originally entered, not the derived monthly-equivalent.
    const prefillAmount =
      item.periodType && item.periodType !== "monthly" ? (item.periodAmount ?? item.amount) : item.amount;
    setEditAmount(String(prefillAmount));
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
        // Must target the budget's own anchor month, not the currently-
        // viewed monthKey — a recurring budget can be shown on a later
        // applicable month, and upserting against that month would create a
        // second, conflicting anchor row instead of updating this one. Must
        // also resubmit the item's own period info whenever it isn't plain
        // monthly, or the edit would silently downgrade it and destroy its
        // recurrence.
        const targetMonth = item.anchorMonth ?? monthKey;
        if (item.periodType && item.periodType !== "monthly") {
          await upsertBudget(item.name, targetMonth, amount, {
            type: item.periodType,
            periodAmount: amount,
          });
        } else {
          await upsertBudget(item.name, targetMonth, amount);
        }
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
      (b) =>
        b.periodType === "monthly" &&
        b.month === lastMonthKey &&
        !claimedCategoryNames.has(b.category.toLowerCase())
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

  const showEmptyState = !isLoading && cardItems.length === 0 && !isAdding;
  const showFab = !isLoading && !isAdding && !showEmptyState && availableCategories.length > 0;

  return (
    <>
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
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                aria-label="Sort budgets"
                className="rounded-md border border-black/10 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
            </div>
          )}
        </div>

        {carryForwardNotice && carryForwardNotice.month === monthKey && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400">
            <span>Budgets carried forward from {carryForwardNotice.fromLabel}</span>
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
                      <label htmlFor="new-budget-period-type" className="text-sm font-medium">
                        Period
                      </label>
                      <select
                        id="new-budget-period-type"
                        value={newPeriodType}
                        onChange={(e) => setNewPeriodType(e.target.value as PeriodType)}
                        className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                      >
                        {ADD_BUDGET_PERIOD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {PERIOD_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label htmlFor="new-budget-amount" className="text-sm font-medium">
                        {newPeriodType === "monthly" ? "Amount" : `Amount per ${PERIOD_NOUN[newPeriodType]}`}
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
              <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 p-10 text-center dark:border-white/10">
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
                  <BudgetSummaryRow budgeted={totals.budgeted} spent={totals.spent} />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {cardItems.map((item, index) => {
                      const isEditing = editingId === item.id;
                      const isExpanded = expandedIds.has(item.id);

                      const effectiveAmount = isEditing ? Number(editAmount) || 0 : item.amount;
                      const percent = effectiveAmount > 0 ? (item.spent / effectiveAmount) * 100 : 0;
                      const remaining = effectiveAmount - item.spent;
                      const pace = isCurrentMonth ? calculatePace(item.spent, item.amount, monthKey) : null;
                      const sparklineValues = sparklineMonths.map((m) => spentForCategories(item.categories, m));
                      const impliedMonthly = impliedMonthlyByName.get(item.name.toLowerCase());
                      const isWeekly = item.periodType === "weekly";
                      const isMultiMonthPeriod =
                        item.periodType === "bi-monthly" ||
                        item.periodType === "quarterly" ||
                        item.periodType === "bi-annual";
                      const weekSpend = isWeekly ? spentInRange(item.categories, getWeekBounds()) : 0;
                      const applicableMonths = isMultiMonthPeriod
                        ? upcomingApplicableMonths(item.anchorMonth ?? monthKey, item.periodType!, monthKey, 3)
                        : [];
                      const nextDue = isMultiMonthPeriod
                        ? nextDueDate(item.anchorMonth ?? monthKey, item.periodType!)
                        : null;
                      const isExpandable = item.kind === "group" || isWeekly;

                      return (
                        <BudgetCard
                          key={item.id}
                          name={item.name}
                          isGroup={item.kind === "group"}
                          categories={item.categories}
                          percent={percent}
                          spent={item.spent}
                          amount={item.amount}
                          remaining={remaining}
                          pace={pace}
                          sparklineValues={sparklineValues}
                          barsReady={barsReady}
                          animationDelayMs={index * CARD_STAGGER_MS}
                          isEditing={isEditing}
                          editAmount={editAmount}
                          onEditAmountChange={setEditAmount}
                          amountFieldLabel={
                            item.periodType && item.periodType !== "monthly"
                              ? `Amount per ${PERIOD_NOUN[item.periodType]}`
                              : "Amount"
                          }
                          isSavingEdit={isSavingEdit}
                          onSaveEdit={() => handleSaveEdit(item)}
                          onCancelEdit={handleCancelEdit}
                          editAriaLabel={`Edit budget for ${item.name}`}
                          deleteAriaLabel={`Delete budget for ${item.name}`}
                          onStartEdit={() => handleStartEdit(item)}
                          onDelete={() => handleDelete(item)}
                          isDeleting={deletingId === item.id}
                          onClick={() => openDrillDown(item)}
                          onViewTransactions={() => openDrillDown(item)}
                          isExpandable={isExpandable}
                          isExpanded={isExpanded}
                          expandAriaLabel={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
                          onToggleExpand={() => toggleExpanded(item.id)}
                          expandedContent={
                            item.kind === "group" ? (
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
                            ) : isWeekly ? (
                              <div className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
                                {weeksInMonth(monthKey).map((week, weekIndex) => (
                                  <div
                                    key={weekIndex}
                                    className="flex items-center justify-between gap-2 text-sm"
                                  >
                                    <span className="text-zinc-700 dark:text-zinc-300">
                                      {formatPeriodLabel(week)}
                                    </span>
                                    <span className="text-zinc-500 dark:text-zinc-400">
                                      {currencyFormatter.format(spentInRange(item.categories, week))} of{" "}
                                      {currencyFormatter.format(item.periodAmount ?? 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : null
                          }
                          badges={
                            impliedMonthly !== undefined ? (
                              <span
                                title="Annual budget for this category, divided by 12"
                                className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                              >
                                Annual: {currencyFormatter.format(impliedMonthly)}/mo implied
                              </span>
                            ) : undefined
                          }
                          extraInfo={
                            isWeekly ? (
                              <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                                This week: {currencyFormatter.format(weekSpend)} of{" "}
                                {currencyFormatter.format(item.periodAmount ?? 0)}
                              </p>
                            ) : isMultiMonthPeriod ? (
                              <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">
                                Applies to: {applicableMonths.map((m) => formatMonthLabel(m)).join(", ")}
                                {nextDue && <> · Next due: {formatMonthLabel(nextDue)}</>}
                              </p>
                            ) : undefined
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

      {showFab && <FloatingAddButton label="Add budget" onClick={handleOpenAdd} />}

      {drillDown && <DrillDownPanel data={drillDown} onClose={() => setDrillDown(null)} />}
    </>
  );
}
