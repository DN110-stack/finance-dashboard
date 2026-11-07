"use client";

import { useState } from "react";
import { useCategories } from "../context/CategoriesContext";
import type { BillInput } from "../context/BillsContext";
import { BILL_FREQUENCIES, BILL_FREQUENCY_LABELS, type Bill, type BillFrequency } from "../lib/bills";
import { toISODate } from "../lib/period";
import BottomSheet from "../components/BottomSheet";

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10";

export default function BillForm({
  bill,
  onSubmit,
  onClose,
  isSaving,
}: {
  bill: Bill | null; // null = creating a new bill
  onSubmit: (input: BillInput) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  const { visibleCategories: categories } = useCategories();
  const [name, setName] = useState(bill?.name ?? "");
  const [amount, setAmount] = useState(bill ? String(bill.amount) : "");
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? "monthly");
  const [dueDate, setDueDate] = useState(bill?.dueDate ?? toISODate(new Date()));
  const [endDate, setEndDate] = useState(bill?.endDate ?? "");
  const [category, setCategory] = useState(bill?.category ?? "");
  const [amountVaries, setAmountVaries] = useState(bill?.amountVaries ?? false);
  const [matchKeyword, setMatchKeyword] = useState(bill?.matchKeyword ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const parsedAmount = Number(amount);
    if (!name.trim()) return setError("Give the bill a name.");
    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount < 0) {
      return setError("Enter a valid amount.");
    }
    if (!dueDate) return setError("Choose the first due date.");
    if (endDate && endDate < dueDate) return setError("The end date can't be before the first due date.");

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        amount: parsedAmount,
        frequency,
        dueDate,
        endDate: endDate || null,
        category: category || null,
        amountVaries,
        matchKeyword: matchKeyword.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save bill");
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={bill ? "Edit bill" : "Add bill"}
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] flex-1 rounded-md border border-black/10 text-sm font-medium dark:border-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="min-h-[44px] flex-1 rounded-md bg-blue-600 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : bill ? "Save changes" : "Add bill"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rent, Netflix, Electricity"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {amountVaries ? "Estimated amount" : "Amount"}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Repeats
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as BillFrequency)}
              className={inputClass}
            >
              {BILL_FREQUENCIES.map((option) => (
                <option key={option} value={option} className="text-zinc-900">
                  {BILL_FREQUENCY_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex min-h-[44px] items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={amountVaries}
            onChange={(e) => setAmountVaries(e.target.checked)}
            className="h-4 w-4"
          />
          The amount varies each time (e.g. utilities) — treat it as an estimate
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Next due date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Ends (optional)
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Category (optional)
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="" className="text-zinc-900">
              None
            </option>
            {categories.map((c) => (
              <option key={c.name} value={c.name} className="text-zinc-900">
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium">
          Match keyword (optional)
          <input
            value={matchKeyword}
            onChange={(e) => setMatchKeyword(e.target.value)}
            placeholder={name.trim() || "Defaults to the bill name"}
            className={inputClass}
          />
          <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
            When an uploaded transaction&apos;s description contains this near the due date, the bill
            is marked paid automatically.
          </span>
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </BottomSheet>
  );
}
