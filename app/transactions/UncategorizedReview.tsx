"use client";

import { useEffect, useState } from "react";
import { useCategories, type Category } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "../lib/csv";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const DEFAULT_COLOUR = "#3b82f6";
const NEW_CATEGORY_VALUE = "__new__";

export default function UncategorizedReview({
  transactions,
  onClose,
}: {
  transactions: Transaction[];
  onClose: () => void;
}) {
  const { categories, addCategory } = useCategories();
  const { assignCategory } = useTransactions();
  const [pending, setPending] = useState(transactions);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [newColours, setNewColours] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pending.length === 0) onClose();
  }, [pending, onClose]);

  async function handleAssign(transaction: Transaction) {
    const id = transaction.id;
    if (!id) return;

    setError(null);
    setBusyId(id);

    try {
      const selection = selections[id];
      let category: Category;

      if (!selection || selection === NEW_CATEGORY_VALUE) {
        const name = (newNames[id] ?? "").trim();
        if (!name) {
          throw new Error("Enter a name for the new category");
        }
        category = await addCategory(name, newColours[id] ?? DEFAULT_COLOUR);
      } else {
        const found = categories.find((c) => c.id === selection);
        if (!found) throw new Error("Choose a category first");
        category = found;
      }

      await assignCategory(transaction, category);
      setPending((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign category");
    } finally {
      setBusyId(null);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-black/10 bg-background p-6 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Review {pending.length} uncategorised transaction{pending.length === 1 ? "" : "s"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Close
          </button>
        </div>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="mt-4 flex flex-col gap-3">
          {pending.map((transaction) => {
            const id = transaction.id!;
            const selection = selections[id] ?? "";

            return (
              <li
                key={id}
                className="rounded-md border border-black/10 p-3 dark:border-white/10"
              >
                <p className="text-sm font-medium">{transaction.description}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {transaction.date} · {currencyFormatter.format(transaction.amount)}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    value={selection}
                    onChange={(event) =>
                      setSelections((prev) => ({ ...prev, [id]: event.target.value }))
                    }
                    className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                  >
                    <option value="" disabled>
                      Choose category…
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                    <option value={NEW_CATEGORY_VALUE}>+ New category</option>
                  </select>

                  {selection === NEW_CATEGORY_VALUE && (
                    <>
                      <input
                        type="text"
                        placeholder="Category name"
                        value={newNames[id] ?? ""}
                        onChange={(event) =>
                          setNewNames((prev) => ({ ...prev, [id]: event.target.value }))
                        }
                        className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                      />
                      <input
                        type="color"
                        value={newColours[id] ?? DEFAULT_COLOUR}
                        onChange={(event) =>
                          setNewColours((prev) => ({ ...prev, [id]: event.target.value }))
                        }
                        className="h-8 w-12 cursor-pointer rounded-md border border-black/10 bg-transparent p-1 dark:border-white/10"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAssign(transaction)}
                    disabled={busyId === id || !selection}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {busyId === id ? "Saving…" : "Assign"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
