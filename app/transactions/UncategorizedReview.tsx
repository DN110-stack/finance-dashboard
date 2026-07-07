"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useCategories, type Category } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "../lib/csv";
import type { CategorySuggestion } from "../lib/categorySuggestions";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const DEFAULT_COLOUR = "#3b82f6";
const NEW_CATEGORY_VALUE = "__new__";

function initialSelections(
  transactions: Transaction[],
  suggestions: Record<string, CategorySuggestion>,
  categories: Category[]
) {
  const selections: Record<string, string> = {};
  const newNames: Record<string, string> = {};

  for (const transaction of transactions) {
    const id = transaction.id;
    if (!id) continue;

    const suggestion = suggestions[id];
    if (!suggestion) continue;

    if (suggestion.isNewCategory) {
      selections[id] = NEW_CATEGORY_VALUE;
      newNames[id] = suggestion.category;
    } else {
      const match = categories.find(
        (c) => c.name.toLowerCase() === suggestion.category.toLowerCase()
      );
      if (match) selections[id] = match.id;
    }
  }

  return { selections, newNames };
}

export default function UncategorizedReview({
  transactions,
  suggestions = {},
  suggestionsLoading = false,
  onClose,
}: {
  transactions: Transaction[];
  suggestions?: Record<string, CategorySuggestion>;
  suggestionsLoading?: boolean;
  onClose: () => void;
}) {
  const { categories, addCategory } = useCategories();
  const { assignCategory } = useTransactions();
  const [pending, setPending] = useState(transactions);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [newColours, setNewColours] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Suggestions can arrive after this modal has already mounted (they're
  // fetched in the background, batch by batch), so they're kept as a
  // fallback derived at render time rather than copied into state — any
  // field the user has actually edited (in `selections`/`newNames`) wins.
  const suggested = useMemo(
    () => initialSelections(pending, suggestions, categories),
    [pending, suggestions, categories]
  );

  function selectionFor(id: string) {
    return selections[id] ?? suggested.selections[id] ?? "";
  }

  function newNameFor(id: string) {
    return newNames[id] ?? suggested.newNames[id] ?? "";
  }

  useEffect(() => {
    if (pending.length === 0) onClose();
  }, [pending, onClose]);

  async function handleAssign(transaction: Transaction) {
    const id = transaction.id;
    if (!id) return;

    setError(null);
    setBusyId(id);

    try {
      const selection = selectionFor(id);
      let category: Category;

      if (!selection || selection === NEW_CATEGORY_VALUE) {
        const name = newNameFor(id).trim();
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

        {suggestionsLoading && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Getting AI category suggestions…
          </p>
        )}

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <ul className="mt-4 flex flex-col gap-3">
          {pending.map((transaction) => {
            const id = transaction.id!;
            const selection = selectionFor(id);
            const hasSuggestion = !!suggestions[id] && !touched[id];

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
                    onChange={(event) => {
                      setSelections((prev) => ({ ...prev, [id]: event.target.value }));
                      setTouched((prev) => ({ ...prev, [id]: true }));
                    }}
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

                  {hasSuggestion && (
                    <span
                      className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400"
                      title="Suggested by AI based on this description"
                    >
                      <Sparkles className="h-3 w-3" />
                      Suggested
                    </span>
                  )}

                  {selection === NEW_CATEGORY_VALUE && (
                    <>
                      <input
                        type="text"
                        placeholder="Category name"
                        value={newNameFor(id)}
                        onChange={(event) => {
                          setNewNames((prev) => ({ ...prev, [id]: event.target.value }));
                          setTouched((prev) => ({ ...prev, [id]: true }));
                        }}
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
