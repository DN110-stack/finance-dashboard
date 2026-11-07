"use client";

import { useState } from "react";
import type { Category } from "../context/CategoriesContext";
import BottomSheet from "../components/BottomSheet";

export type GroupBudgetEdit = {
  name: string;
  amount: number;
  categories: string[]; // category names
};

const inputClass =
  "rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10";

// Edits a group budget's name, amount and which categories it covers.
// `options` is every category the group could cover — its own current ones
// plus any not already budgeted elsewhere this month.
export default function GroupBudgetEditSheet({
  initial,
  options,
  onSubmit,
  onClose,
  isSaving,
}: {
  initial: GroupBudgetEdit;
  options: Category[];
  onSubmit: (edit: GroupBudgetEdit) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(String(initial.amount));
  const [selected, setSelected] = useState(
    () => new Set(initial.categories.map((c) => c.toLowerCase()))
  );
  const [error, setError] = useState<string | null>(null);

  function toggle(categoryName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = categoryName.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit() {
    const parsedAmount = Number(amount);
    if (!name.trim()) return setError("Enter a group name");
    if (!amount.trim() || Number.isNaN(parsedAmount) || parsedAmount < 0) {
      return setError("Enter a valid amount");
    }
    const categories = options.filter((c) => selected.has(c.name.toLowerCase())).map((c) => c.name);
    if (categories.length === 0) return setError("Select at least one category");

    setError(null);
    try {
      await onSubmit({ name: name.trim(), amount: parsedAmount, categories });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group budget");
    }
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Edit group budget"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="min-h-[44px] flex-1 rounded-md border border-black/10 text-sm font-medium disabled:opacity-50 dark:border-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="min-h-[44px] flex-1 rounded-md bg-blue-600 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Categories ({selected.size} selected)</span>
          <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-md border border-black/10 p-3 sm:grid-cols-3 dark:border-white/10">
            {options.map((category) => (
              <label
                key={category.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <input
                  type="checkbox"
                  checked={selected.has(category.name.toLowerCase())}
                  onChange={() => toggle(category.name)}
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
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Categories that already have their own budget this month aren&apos;t listed.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </BottomSheet>
  );
}
