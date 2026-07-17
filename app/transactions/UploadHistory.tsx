"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTransactions } from "../context/TransactionsContext";
import { BANK_BADGE_STYLES } from "../lib/banks";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function UploadHistory() {
  const { batches, transactions, deleteBatch } = useTransactions();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(batchId: string, bank: string, count: number) {
    const confirmed = window.confirm(
      `Delete this ${bank} upload and all ${count} of its transactions? This can't be undone.`
    );
    if (!confirmed) return;

    setError(null);
    setDeletingId(batchId);
    try {
      await deleteBatch(batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete upload");
    } finally {
      setDeletingId(null);
    }
  }

  if (batches.length === 0) {
    return (
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        No uploads yet — upload a CSV from the Transactions tab to get started.
      </p>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Upload History</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {transactions.length} total transaction{transactions.length === 1 ? "" : "s"} across{" "}
          {batches.length} upload{batches.length === 1 ? "" : "s"}
        </p>
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
        {batches.map((batch) => (
          <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  BANK_BADGE_STYLES[batch.sourceBank] ??
                  "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400"
                }`}
              >
                {batch.sourceBank}
              </span>
              {batch.fileName && (
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {batch.fileName}
                </span>
              )}
              <span className="text-sm">
                {batch.transactionCount} transaction{batch.transactionCount === 1 ? "" : "s"}
                {batch.skippedCount > 0 && (
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {" "}
                    ({batch.skippedCount} duplicate{batch.skippedCount === 1 ? "" : "s"} skipped)
                  </span>
                )}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDate(batch.createdAt)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(batch.id, batch.sourceBank, batch.transactionCount)}
              disabled={deletingId === batch.id}
              aria-label={`Delete ${batch.sourceBank} upload`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
