"use client";

import { X } from "lucide-react";
import type { BankFormat } from "../lib/csv";
import type { Category } from "../context/CategoriesContext";
import { groupCategoriesByParent, UNGROUPED } from "../lib/categories";
import { UNCATEGORIZED } from "../lib/rules";
import BottomSheet from "../components/BottomSheet";

export type OneOffFilterValue = "" | "hide" | "only";

// Category filter values are prefixed so "Food" the parent (all Food-related
// transactions) and "Food" the exact leaf category can both be selected —
// they resolve to different filtering logic in TransactionsTable.
export const PARENT_FILTER_PREFIX = "parent:";
export const CATEGORY_FILTER_PREFIX = "category:";
// An arbitrary, comma-separated set of exact category names — used by budget
// group drill-downs, whose category set doesn't necessarily line up with any
// single parent group.
export const CATEGORIES_FILTER_PREFIX = "categories:";

export type TransactionFilterState = {
  search: string;
  category: string;
  bank: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  oneOff: OneOffFilterValue;
};

export const EMPTY_TRANSACTION_FILTERS: TransactionFilterState = {
  search: "",
  category: "",
  bank: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
  oneOff: "",
};

// Counts distinct filter *groups* in use — date-from/to count as one group,
// as do min/max amount — so the badge reflects how many kinds of filtering
// are applied rather than how many individual fields happen to be filled in.
export function countActiveTransactionFilters(filters: TransactionFilterState): number {
  return [
    filters.search.trim() !== "",
    filters.category !== "",
    filters.bank !== "",
    filters.dateFrom !== "" || filters.dateTo !== "",
    filters.amountMin !== "" || filters.amountMax !== "",
    filters.oneOff !== "",
  ].filter(Boolean).length;
}

// Builds a /transactions link that pre-applies a partial set of filters —
// used by dashboard chart drill-downs so "View in Transactions" lands on
// exactly the same rows the drill-down panel showed.
export function buildTransactionsHref(filters: Partial<TransactionFilterState>): string {
  const merged = { ...EMPTY_TRANSACTION_FILTERS, ...filters };
  const params = new URLSearchParams();

  if (merged.search) params.set("search", merged.search);
  if (merged.category) params.set("category", merged.category);
  if (merged.bank) params.set("bank", merged.bank);
  if (merged.dateFrom) params.set("dateFrom", merged.dateFrom);
  if (merged.dateTo) params.set("dateTo", merged.dateTo);
  if (merged.amountMin) params.set("amountMin", merged.amountMin);
  if (merged.amountMax) params.set("amountMax", merged.amountMax);
  if (merged.oneOff) params.set("oneOff", merged.oneOff);

  const query = params.toString();
  return query ? `/transactions?${query}` : "/transactions";
}

// The inverse of buildTransactionsHref — reads a TransactionFilterState back
// out of the URL so the Transactions page can seed its filters from a link.
export function filtersFromSearchParams(params: URLSearchParams): TransactionFilterState {
  const oneOff = params.get("oneOff");
  return {
    search: params.get("search") ?? "",
    category: params.get("category") ?? "",
    bank: params.get("bank") ?? "",
    dateFrom: params.get("dateFrom") ?? "",
    dateTo: params.get("dateTo") ?? "",
    amountMin: params.get("amountMin") ?? "",
    amountMax: params.get("amountMax") ?? "",
    oneOff: oneOff === "hide" || oneOff === "only" ? oneOff : "",
  };
}

const fieldClasses =
  "w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-black/20 focus:outline-none dark:border-white/10 dark:focus:border-white/20";

const labelClasses = "mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400";

type Props = {
  filters: TransactionFilterState;
  onChange: (filters: TransactionFilterState) => void;
  categories: Category[];
  availableBanks: BankFormat[];
  // The mobile "Filter" trigger lives in TransactionsTable's header now (so
  // it can sit side by side with Upload CSV), so the sheet's open state is
  // controlled from there instead of owned locally.
  isSheetOpen: boolean;
  onCloseSheet: () => void;
};

export default function TransactionFilters({
  filters,
  onChange,
  categories,
  availableBanks,
  isSheetOpen,
  onCloseSheet,
}: Props) {
  const activeCount = countActiveTransactionFilters(filters);
  const groups = groupCategoriesByParent(categories);
  const parentGroups = groups.filter((g) => g.parent !== UNGROUPED);
  const ungroupedGroup = groups.find((g) => g.parent === UNGROUPED);

  function set<K extends keyof TransactionFilterState>(key: K, value: TransactionFilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  const fields = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={labelClasses}>Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search by description…"
            className={fieldClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>Category</label>
          <select
            value={filters.category}
            onChange={(e) => set("category", e.target.value)}
            className={fieldClasses}
          >
            <option value="">All categories</option>
            <option value={`${CATEGORY_FILTER_PREFIX}${UNCATEGORIZED}`}>{UNCATEGORIZED}</option>

            {parentGroups.length > 0 && (
              <optgroup label="Parent categories">
                {parentGroups.map(({ parent }) => (
                  <option key={parent} value={`${PARENT_FILTER_PREFIX}${parent}`}>
                    {parent} (all)
                  </option>
                ))}
              </optgroup>
            )}

            {parentGroups.map(({ parent, categories: group }) => (
              <optgroup key={parent} label={parent}>
                {group.map((category) => (
                  <option key={category.id} value={`${CATEGORY_FILTER_PREFIX}${category.name}`}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            ))}

            {ungroupedGroup && (
              <optgroup label={UNGROUPED}>
                {ungroupedGroup.categories.map((category) => (
                  <option key={category.id} value={`${CATEGORY_FILTER_PREFIX}${category.name}`}>
                    {category.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <div>
          <label className={labelClasses}>Bank</label>
          <select
            value={filters.bank}
            onChange={(e) => set("bank", e.target.value)}
            disabled={availableBanks.length === 0}
            className={fieldClasses}
          >
            <option value="">All banks</option>
            {availableBanks.map((bank) => (
              <option key={bank} value={bank}>
                {bank}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClasses}>From date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            className={fieldClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>To date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            className={fieldClasses}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClasses}>Min amount</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filters.amountMin}
              onChange={(e) => set("amountMin", e.target.value)}
              placeholder="-100"
              className={fieldClasses}
            />
          </div>
          <div className="flex-1">
            <label className={labelClasses}>Max amount</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={filters.amountMax}
              onChange={(e) => set("amountMax", e.target.value)}
              placeholder="100"
              className={fieldClasses}
            />
          </div>
        </div>

        <div>
          <label className={labelClasses}>One-off</label>
          <select
            value={filters.oneOff}
            onChange={(e) => set("oneOff", e.target.value as OneOffFilterValue)}
            className={fieldClasses}
          >
            <option value="">All transactions</option>
            <option value="hide">Hide one-off</option>
            <option value="only">Only one-off</option>
          </select>
        </div>
      </div>
  );

  const clearButton = activeCount > 0 && (
    <button
      type="button"
      onClick={() => onChange(EMPTY_TRANSACTION_FILTERS)}
      className="flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
    >
      <X className="h-3.5 w-3.5" />
      Clear all filters
    </button>
  );

  return (
    <>
      {/* Mobile: the "Filter" trigger button lives in TransactionsTable's
          header, alongside Upload CSV — this just owns the sheet content. */}
      <BottomSheet title="Filters" open={isSheetOpen} onClose={onCloseSheet}>
        {fields}
        {clearButton && <div className="mt-3">{clearButton}</div>}
      </BottomSheet>

      {/* Desktop: the field set stays inline. */}
      <div className="mt-4 hidden rounded-lg border border-black/10 p-4 sm:block dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Filters</h2>
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-black/10 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
                {activeCount} active
              </span>
            )}
          </div>
          {clearButton}
        </div>

        <div className="mt-3">{fields}</div>
      </div>
    </>
  );
}
