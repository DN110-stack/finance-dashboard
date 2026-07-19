"use client";

import { Trash2 } from "lucide-react";
import type { Transaction } from "../lib/csv";
import { UNCATEGORIZED } from "../lib/rules";
import CategoryCell from "./CategoryCell";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

// "02 Jul" — compact enough for a card header row alongside the amount.
function formatCompactDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${String(date.getDate()).padStart(2, "0")} ${date.toLocaleDateString("en-US", { month: "short" })}`;
}

// The mobile-only card representation of a transaction row — desktop keeps
// the table. Long-press/tap gestures are handled entirely by the parent
// (TransactionsTable) and wired in as plain callbacks here, scoped to only
// the collapsed header area so tapping the expanded controls below (category
// select, one-off toggle, delete) never also triggers expand/select.
export default function TransactionCard({
  transaction,
  isExpanded,
  isSelectionMode,
  isSelected,
  isDeleting,
  isTogglingOneOff,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDelete,
  onToggleOneOff,
}: {
  transaction: Transaction;
  isExpanded: boolean;
  isSelectionMode: boolean;
  isSelected: boolean;
  isDeleting: boolean;
  isTogglingOneOff: boolean;
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onDelete: () => void;
  onToggleOneOff: () => void;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border transition-colors ${
        isSelected
          ? "border-blue-400 bg-blue-50 dark:border-blue-500/50 dark:bg-blue-500/10"
          : transaction.category === UNCATEGORIZED
            ? "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
            : "border-black/10 dark:border-white/10"
      }`}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        aria-expanded={isExpanded}
        className="cursor-pointer touch-manipulation p-3 select-none"
      >
        <div className="flex items-center gap-2">
          {isSelectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              readOnly
              aria-hidden="true"
              tabIndex={-1}
              className="h-4 w-4 shrink-0 rounded border-black/20 dark:border-white/20"
            />
          )}
          <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
            {formatCompactDate(transaction.date)}
          </span>
          <div className="min-w-2 flex-1" />
          <span
            className={`shrink-0 text-sm font-medium whitespace-nowrap ${
              transaction.amount < 0
                ? "text-zinc-900 dark:text-zinc-100"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {transaction.amount < 0 ? "-" : "+"}
            {currencyFormatter.format(Math.abs(transaction.amount))}
          </span>
        </div>

        <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
          {transaction.description}
          {transaction.isOneOff && (
            <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-slate-600 dark:bg-slate-500/10 dark:text-slate-400">
              One-off
            </span>
          )}
        </p>
      </div>

      {isExpanded && !isSelectionMode && (
        <div className="flex flex-col gap-3 border-t border-black/10 p-3 dark:border-white/10">
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Category
            </span>
            <CategoryCell transaction={transaction} />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onToggleOneOff}
              disabled={!transaction.id || isTogglingOneOff}
              aria-pressed={!!transaction.isOneOff}
              className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:text-zinc-300"
            >
              <span
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  transaction.isOneOff ? "bg-amber-500" : "bg-black/10 dark:bg-white/15"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    transaction.isOneOff ? "translate-x-3.5" : "translate-x-0.5"
                  }`}
                />
              </span>
              One-off
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={!transaction.id || isDeleting}
              aria-label={`Delete ${transaction.description}`}
              className="flex min-h-[44px] items-center gap-1.5 rounded-md px-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
