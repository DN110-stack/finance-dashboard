"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useTransactions } from "../context/TransactionsContext";
import { useCategories } from "../context/CategoriesContext";
import { parseTransactionsCSV, type BankFormat, type Transaction } from "../lib/csv";
import { UNCATEGORIZED } from "../lib/rules";
import { BANK_BADGE_STYLES } from "../lib/banks";
import { resolveGroupName } from "../lib/categories";
import { fetchCategorySuggestions, type CategorySuggestion } from "../lib/categorySuggestions";
import CategoryCell from "./CategoryCell";
import UncategorizedReview from "./UncategorizedReview";
import TransactionFilters, {
  EMPTY_TRANSACTION_FILTERS,
  countActiveTransactionFilters,
  CATEGORY_FILTER_PREFIX,
  PARENT_FILTER_PREFIX,
  type TransactionFilterState,
} from "./TransactionFilters";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type SortColumn = "date" | "description" | "category" | "amount";

const PER_PAGE_OPTIONS = [25, 50, 100, 250] as const;

function SortIcon({ direction }: { direction: "asc" | "desc" }) {
  return direction === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5" />
  );
}

export default function TransactionsTable() {
  const { transactions, isLoading, addTransactions, deleteTransactions, setTransactionOneOff } =
    useTransactions();
  const { categories, isLoading: categoriesLoading } = useCategories();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [detectedBank, setDetectedBank] = useState<BankFormat | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Transaction[]>([]);
  const [reviewSuggestions, setReviewSuggestions] = useState<Record<string, CategorySuggestion>>(
    {}
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [togglingOneOffIds, setTogglingOneOffIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<TransactionFilterState>(EMPTY_TRANSACTION_FILTERS);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [perPage, setPerPage] = useState<number>(50);
  const [page, setPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const availableBanks = useMemo(
    () =>
      Array.from(new Set(transactions.map((t) => t.sourceBank).filter((b): b is BankFormat => !!b))),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const min = filters.amountMin.trim() === "" ? null : Number(filters.amountMin);
    const max = filters.amountMax.trim() === "" ? null : Number(filters.amountMax);

    return transactions.filter((t) => {
      if (search && !t.description.toLowerCase().includes(search)) return false;
      if (filters.category.startsWith(PARENT_FILTER_PREFIX)) {
        const parent = filters.category.slice(PARENT_FILTER_PREFIX.length);
        if (resolveGroupName(t.category, categories) !== parent) return false;
      } else if (filters.category.startsWith(CATEGORY_FILTER_PREFIX)) {
        const name = filters.category.slice(CATEGORY_FILTER_PREFIX.length);
        if (t.category !== name) return false;
      }
      if (filters.bank && t.sourceBank !== filters.bank) return false;
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (min !== null && !Number.isNaN(min) && t.amount < min) return false;
      if (max !== null && !Number.isNaN(max) && t.amount > max) return false;
      if (filters.oneOff === "hide" && t.isOneOff) return false;
      if (filters.oneOff === "only" && !t.isOneOff) return false;
      return true;
    });
  }, [transactions, filters, categories]);

  const hasActiveFilters = countActiveTransactionFilters(filters) > 0;

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "date":
          comparison = a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
          break;
        case "description":
          comparison = a.description.localeCompare(b.description);
          break;
        case "category":
          comparison = a.category.localeCompare(b.category);
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
    return sorted;
  }, [filteredTransactions, sortColumn, sortDirection]);

  const totalItems = sortedTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const currentPage = Math.min(page, totalPages);

  const paginatedTransactions = useMemo(
    () => sortedTransactions.slice((currentPage - 1) * perPage, currentPage * perPage),
    [sortedTransactions, currentPage, perPage]
  );

  // Filtering or re-sorting can change which page makes sense to be on —
  // e.g. narrowing a filter down to 3 results while viewing page 4. Adjusting
  // state during render (rather than in an effect) avoids an extra commit.
  const sortAndFilterKey = JSON.stringify(filters) + sortColumn + sortDirection;
  const [prevSortAndFilterKey, setPrevSortAndFilterKey] = useState(sortAndFilterKey);
  if (sortAndFilterKey !== prevSortAndFilterKey) {
    setPrevSortAndFilterKey(sortAndFilterKey);
    setPage(1);
  }

  const [prevPageForInput, setPrevPageForInput] = useState(currentPage);
  if (currentPage !== prevPageForInput) {
    setPrevPageForInput(currentPage);
    setPageInputValue(String(currentPage));
  }

  const selectableIds = paginatedTransactions.filter((t) => t.id).map((t) => t.id as string);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));
  const someSelected = !allSelected && selectableIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }

  function commitPageInput() {
    const parsed = parseInt(pageInputValue, 10);
    if (!Number.isNaN(parsed)) {
      setPage(Math.min(Math.max(parsed, 1), totalPages));
    } else {
      setPageInputValue(String(currentPage));
    }
  }

  // Selecting "all" only affects rows on the current page — selections on
  // other pages are preserved rather than being clobbered.
  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of selectableIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteOne(transaction: Transaction) {
    if (!transaction.id) return;
    const confirmed = window.confirm(
      `Delete "${transaction.description}"? This can't be undone.`
    );
    if (!confirmed) return;

    const id = transaction.id;
    setError(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await deleteTransactions([id]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setReviewQueue((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleToggleOneOff(transaction: Transaction) {
    const id = transaction.id;
    if (!id) return;

    setError(null);
    setTogglingOneOffIds((prev) => new Set(prev).add(id));
    try {
      await setTransactionOneOff(id, !transaction.isOneOff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update transaction");
    } finally {
      setTogglingOneOffIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = window.confirm(
      `Delete ${ids.length} selected transaction${ids.length === 1 ? "" : "s"}? This can't be undone.`
    );
    if (!confirmed) return;

    setError(null);
    setIsBulkDeleting(true);
    try {
      await deleteTransactions(ids);
      const deletedIdSet = new Set(ids);
      setSelectedIds(new Set());
      setReviewQueue((prev) => prev.filter((t) => !t.id || !deletedIdSet.has(t.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected transactions");
    } finally {
      setIsBulkDeleting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const parsed = parseTransactionsCSV(text);
      if (parsed.transactions.length === 0) {
        throw new Error("No transactions found in CSV");
      }
      const { inserted, skippedCount } = await addTransactions(
        parsed.transactions,
        parsed.bank,
        file.name
      );
      setDetectedBank(parsed.bank);
      setError(null);
      setNotice(
        `Added ${inserted.length} new transaction${inserted.length === 1 ? "" : "s"}` +
          (skippedCount > 0
            ? ` — skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
            : ".")
      );

      const uncategorized = inserted.filter((t) => t.category === UNCATEGORIZED);
      if (uncategorized.length > 0) {
        // Open the review screen right away rather than waiting on the AI —
        // suggestions fill in as they arrive, and the screen still works if
        // they never do (network failure, timeout, etc).
        setReviewSuggestions({});
        setReviewQueue(uncategorized);
        setSuggestionsLoading(true);
        fetchCategorySuggestions(
          uncategorized.map((t) => t.description),
          categories.map((c) => c.name)
        )
          .then((suggestions) => {
            const suggestionsById: Record<string, CategorySuggestion> = {};
            for (const suggestion of suggestions) {
              const id = uncategorized[suggestion.index]?.id;
              if (id) suggestionsById[id] = suggestion;
            }
            setReviewSuggestions(suggestionsById);
          })
          .finally(() => setSuggestionsLoading(false));
      }
    } catch (err) {
      setNotice(null);
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {isLoading
              ? "Loading transactions…"
              : hasActiveFilters
                ? `${filteredTransactions.length} of ${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`
                : `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`}
          </p>
          {detectedBank && (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${BANK_BADGE_STYLES[detectedBank]}`}
            >
              {detectedBank}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              {isBulkDeleting ? "Deleting…" : `Delete selected (${selectedIds.size})`}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading || categoriesLoading}
            className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            {isUploading
              ? "Uploading…"
              : categoriesLoading
                ? "Loading…"
                : "Upload CSV"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {notice && !error && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
      )}

      <TransactionFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        availableBanks={availableBanks}
      />

      <div className="mt-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all transactions"
                  className="h-4 w-4 cursor-pointer rounded border-black/20 dark:border-white/20"
                />
              </th>
              <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => handleSort("date")}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
                >
                  Date
                  {sortColumn === "date" && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => handleSort("description")}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
                >
                  Description
                  {sortColumn === "description" && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => handleSort("category")}
                  className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
                >
                  Category
                  {sortColumn === "category" && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">
                <button
                  type="button"
                  onClick={() => handleSort("amount")}
                  className="ml-auto flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
                >
                  Amount
                  {sortColumn === "amount" && <SortIcon direction={sortDirection} />}
                </button>
              </th>
              <th className="px-4 py-3 text-center font-medium text-zinc-500 dark:text-zinc-400">
                One-off
              </th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {!isLoading && filteredTransactions.length === 0 && transactions.length > 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400"
                >
                  No transactions match your filters.
                </td>
              </tr>
            )}
            {paginatedTransactions.map((transaction, index) => {
              const id = transaction.id;
              const isDeleting = !!id && deletingIds.has(id);
              return (
                <tr
                  key={`${transaction.date}-${transaction.description}-${index}`}
                  className={
                    transaction.category === UNCATEGORIZED
                      ? "bg-amber-50 dark:bg-amber-500/10"
                      : undefined
                  }
                >
                  <td className="px-4 py-3 align-top">
                    <input
                      type="checkbox"
                      checked={!!id && selectedIds.has(id)}
                      onChange={() => id && toggleRow(id)}
                      disabled={!id}
                      aria-label={`Select ${transaction.description}`}
                      className="h-4 w-4 cursor-pointer rounded border-black/20 dark:border-white/20"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {transaction.date}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {transaction.description}
                      {transaction.isOneOff && (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-500/10 dark:text-slate-400">
                          One-off
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <CategoryCell transaction={transaction} />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                      transaction.amount < 0
                        ? "text-zinc-900 dark:text-zinc-100"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {transaction.amount < 0 ? "-" : "+"}
                    {currencyFormatter.format(Math.abs(transaction.amount))}
                  </td>
                  <td className="px-4 py-3 text-center align-top">
                    <button
                      type="button"
                      onClick={() => handleToggleOneOff(transaction)}
                      disabled={!id || togglingOneOffIds.has(id)}
                      aria-pressed={!!transaction.isOneOff}
                      aria-label={
                        transaction.isOneOff
                          ? `Unmark ${transaction.description} as one-off`
                          : `Mark ${transaction.description} as one-off`
                      }
                      title={
                        transaction.isOneOff
                          ? "One-off transaction — click to unmark"
                          : "Mark as one-off (excluded from dashboard totals)"
                      }
                      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                        transaction.isOneOff ? "bg-amber-500" : "bg-black/10 dark:bg-white/15"
                      }`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                          transaction.isOneOff ? "translate-x-3.5" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <button
                      type="button"
                      onClick={() => handleDeleteOne(transaction)}
                      disabled={!id || isDeleting}
                      aria-label={`Delete ${transaction.description}`}
                      className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            {totalItems === 0
              ? "No transactions"
              : `Showing ${(currentPage - 1) * perPage + 1}-${Math.min(currentPage * perPage, totalItems)} of ${totalItems} transaction${totalItems === 1 ? "" : "s"}`}
          </span>
          <label className="flex items-center gap-1.5">
            Per page
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm focus:border-black/20 focus:outline-none dark:border-white/10 dark:focus:border-white/20"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-md border border-black/10 px-3 py-1.5 font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            Previous
          </button>
          <div className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
            Page
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInputValue}
              onChange={(e) => setPageInputValue(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitPageInput();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="Jump to page"
              className="w-14 rounded-md border border-black/10 bg-transparent px-2 py-1 text-center text-sm focus:border-black/20 focus:outline-none dark:border-white/10 dark:focus:border-white/20"
            />
            of {totalPages}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-black/10 px-3 py-1.5 font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            Next
          </button>
        </div>
      </div>

      {reviewQueue.length > 0 && (
        <UncategorizedReview
          transactions={reviewQueue}
          suggestions={reviewSuggestions}
          suggestionsLoading={suggestionsLoading}
          onClose={() => {
            setReviewQueue([]);
            setReviewSuggestions({});
          }}
        />
      )}
    </>
  );
}
