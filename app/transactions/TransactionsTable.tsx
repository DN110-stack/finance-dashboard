"use client";

import { useRef, useState } from "react";
import { useTransactions } from "../context/TransactionsContext";
import { parseTransactionsCSV, type BankFormat, type Transaction } from "../lib/csv";
import { UNCATEGORIZED } from "../lib/rules";
import { BANK_BADGE_STYLES } from "../lib/banks";
import CategoryCell from "./CategoryCell";
import UncategorizedReview from "./UncategorizedReview";
import UploadHistory from "./UploadHistory";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function TransactionsTable() {
  const { transactions, isLoading, addTransactions } = useTransactions();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [detectedBank, setDetectedBank] = useState<BankFormat | null>(null);
  const [reviewQueue, setReviewQueue] = useState<Transaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleUploadClick() {
    fileInputRef.current?.click();
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
      const { inserted, skippedCount } = await addTransactions(parsed.transactions, parsed.bank);
      setDetectedBank(parsed.bank);
      setError(null);
      setNotice(
        `Added ${inserted.length} new transaction${inserted.length === 1 ? "" : "s"}` +
          (skippedCount > 0
            ? ` — skipped ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"}.`
            : ".")
      );

      const uncategorized = inserted.filter((t) => t.category === UNCATEGORIZED);
      if (uncategorized.length > 0) setReviewQueue(uncategorized);
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
        <div>
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
            disabled={isUploading}
            className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
          >
            {isUploading ? "Uploading…" : "Upload CSV"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {notice && !error && (
        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-black/5 dark:bg-white/5">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Date</th>
              <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Description</th>
              <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Category</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-500 dark:text-zinc-400">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/10 dark:divide-white/10">
            {transactions.map((transaction, index) => (
              <tr
                key={`${transaction.date}-${transaction.description}-${index}`}
                className={
                  transaction.category === UNCATEGORIZED
                    ? "bg-amber-50 dark:bg-amber-500/10"
                    : undefined
                }
              >
                <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                  {transaction.date}
                </td>
                <td className="px-4 py-3 font-medium">{transaction.description}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UploadHistory />

      {reviewQueue.length > 0 && (
        <UncategorizedReview
          transactions={reviewQueue}
          onClose={() => setReviewQueue([])}
        />
      )}
    </>
  );
}
