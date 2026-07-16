"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, CircleCheck, Pencil, Trash2, TriangleAlert } from "lucide-react";
import type { PaceStatus } from "../lib/budgets";
import DonutMeter from "./DonutMeter";
import Sparkline from "./Sparkline";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type CardCategory = { id: string; name: string; colour: string };

type Props = {
  name: string;
  isGroup: boolean;
  categories: CardCategory[];
  percent: number;
  spent: number;
  amount: number;
  remaining: number;
  pace: PaceStatus | null;
  sparklineValues: number[];
  barsReady: boolean;
  animationDelayMs: number;

  isEditing: boolean;
  editAmount: string;
  onEditAmountChange: (value: string) => void;
  amountFieldLabel: string;
  isSavingEdit: boolean;
  onSaveEdit: () => void;
  onCancelEdit: () => void;

  editAriaLabel: string;
  deleteAriaLabel: string;
  onStartEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;

  onClick: () => void;
  onViewTransactions: () => void;

  isExpandable?: boolean;
  isExpanded?: boolean;
  expandAriaLabel?: string;
  onToggleExpand?: () => void;
  expandedContent?: ReactNode;

  badges?: ReactNode;
  extraInfo?: ReactNode;
  actionError?: string;
};

// The compact grid card shared by BudgetManager (Monthly) and
// AnnualBudgetManager (Annual) — a donut meter replaces the old linear
// progress bar as the card's visual centerpiece, everything else (edit,
// delete, expand, drill-down) works exactly as it did in the stacked-row
// layout, just laid out for a grid cell instead of a full-width row.
export default function BudgetCard({
  name,
  isGroup,
  categories,
  percent,
  spent,
  amount,
  remaining,
  pace,
  sparklineValues,
  barsReady,
  animationDelayMs,
  isEditing,
  editAmount,
  onEditAmountChange,
  amountFieldLabel,
  isSavingEdit,
  onSaveEdit,
  onCancelEdit,
  editAriaLabel,
  deleteAriaLabel,
  onStartEdit,
  onDelete,
  isDeleting,
  onClick,
  onViewTransactions,
  isExpandable = false,
  isExpanded = false,
  expandAriaLabel,
  onToggleExpand,
  expandedContent,
  badges,
  extraInfo,
  actionError,
}: Props) {
  return (
    <div
      onClick={() => !isEditing && onClick()}
      style={{ animationDelay: `${animationDelayMs}ms` }}
      className={`animate-[budget-card-in_0.35s_ease-out_backwards] rounded-xl border border-black/10 p-4 dark:border-white/10 ${
        isEditing ? "" : "cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isGroup ? (
            <div className="flex -space-x-1.5">
              {categories.slice(0, 5).map((c) => (
                <span
                  key={c.id}
                  title={c.name}
                  className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-background"
                  style={{ backgroundColor: c.colour }}
                />
              ))}
              {categories.length > 5 && (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-[8px] font-medium text-zinc-700 ring-2 ring-background dark:bg-zinc-600 dark:text-zinc-200">
                  +{categories.length - 5}
                </span>
              )}
            </div>
          ) : (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: categories[0]?.colour }}
            />
          )}
          <span className="truncate font-medium">{name}</span>
          {isExpandable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand?.();
              }}
              aria-label={expandAriaLabel}
              aria-expanded={isExpanded}
              className="shrink-0 rounded-md p-1 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>

        {!isEditing && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit();
              }}
              aria-label={editAriaLabel}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              disabled={isDeleting}
              aria-label={deleteAriaLabel}
              className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}

      {isEditing ? (
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {amountFieldLabel}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editAmount}
            onChange={(e) => onEditAmountChange(e.target.value)}
            autoFocus
            className="w-full rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={isSavingEdit || !editAmount.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isSavingEdit ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isSavingEdit}
              className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col items-center gap-2 text-center">
            <DonutMeter percent={percent} ready={barsReady} />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {currencyFormatter.format(spent)} of {currencyFormatter.format(amount)}
            </p>
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
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  pace === "atRisk"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
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

          {extraInfo}

          <div className="mt-3 flex items-center justify-between gap-2">
            <Sparkline values={sparklineValues} />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewTransactions();
              }}
              className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              View transactions
            </button>
          </div>
        </>
      )}

      {isExpandable && isExpanded && expandedContent}

      {actionError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{actionError}</p>}
    </div>
  );
}
