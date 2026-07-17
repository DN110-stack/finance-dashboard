"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Loader2, Sparkles } from "lucide-react";
import { useCategories, type Category } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "../lib/csv";
import type { CategorySuggestion } from "../lib/categorySuggestions";
import { distinctParents, groupCategoriesByParent, UNGROUPED } from "../lib/categories";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const DEFAULT_COLOUR = "#3b82f6";
const NEW_CATEGORY_VALUE = "__new__";
const NEW_PARENT_VALUE = "__new_parent__";

function initialSelections(
  transactions: Transaction[],
  suggestions: Record<string, CategorySuggestion>,
  categories: Category[]
) {
  const selections: Record<string, string> = {};

  for (const transaction of transactions) {
    const id = transaction.id;
    if (!id) continue;

    const suggestion = suggestions[id];
    if (!suggestion) continue;

    // Suggestions only ever name an existing category, but the categories
    // list can still change out from under an already-mounted suggestion
    // (e.g. deleted mid-review), so guard the lookup anyway.
    const match = categories.find(
      (c) => c.name.toLowerCase() === suggestion.category.toLowerCase()
    );
    if (match) selections[id] = match.id;
  }

  return { selections };
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
  const { assignCategory, assignCategories } = useTransactions();
  const [pending, setPending] = useState(transactions);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [newNames, setNewNames] = useState<Record<string, string>>({});
  const [newColours, setNewColours] = useState<Record<string, string>>({});
  const [newParents, setNewParents] = useState<Record<string, string>>({});
  const [newParentNames, setNewParentNames] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestionCount = Object.keys(suggestions).length;

  // Suggestions can arrive after this modal has already mounted (they're
  // fetched in the background, batch by batch), so they're kept as a
  // fallback derived at render time rather than copied into state — any
  // field the user has actually edited (in `selections`/`newNames`) wins.
  const suggested = useMemo(
    () => initialSelections(pending, suggestions, categories),
    [pending, suggestions, categories]
  );

  const groups = useMemo(() => groupCategoriesByParent(categories), [categories]);
  const parentOptions = useMemo(() => distinctParents(categories), [categories]);

  function selectionFor(id: string) {
    return selections[id] ?? suggested.selections[id] ?? "";
  }

  function newNameFor(id: string) {
    return newNames[id] ?? "";
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
        const parentSelection = newParents[id] ?? UNGROUPED;
        const parentCategory =
          parentSelection === UNGROUPED
            ? null
            : parentSelection === NEW_PARENT_VALUE
              ? (newParentNames[id] ?? "").trim() || null
              : parentSelection;
        category = await addCategory(name, newColours[id] ?? DEFAULT_COLOUR, parentCategory);
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

  async function handleAcceptAll() {
    setError(null);
    setAcceptingAll(true);

    try {
      // Every suggestion already names an existing category (the API route
      // guarantees it) — just resolve each one to its Category record.
      const assignments: { transaction: Transaction; category: Category }[] = [];

      for (const transaction of pending) {
        const id = transaction.id;
        if (!id) continue;

        const suggestion = suggestions[id];
        if (!suggestion) continue;

        const category = categories.find(
          (c) => c.name.toLowerCase() === suggestion.category.toLowerCase()
        );

        if (category) assignments.push({ transaction, category });
      }

      if (assignments.length === 0) {
        throw new Error("No AI suggestions to accept yet");
      }

      await assignCategories(assignments);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept suggestions");
    } finally {
      setAcceptingAll(false);
    }
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-black/10 bg-background p-4 sm:p-6 dark:border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">
            Review {pending.length} uncategorised transaction{pending.length === 1 ? "" : "s"}
          </h2>
          <div className="flex items-center gap-3">
            {!suggestionsLoading && suggestionCount > 0 && (
              <button
                type="button"
                onClick={handleAcceptAll}
                disabled={acceptingAll || busyId !== null}
                className="flex min-h-[44px] items-center gap-1.5 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCheck className="h-4 w-4" />
                {acceptingAll ? "Accepting…" : "Accept all suggestions"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={acceptingAll}
              className="flex min-h-[44px] items-center text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
            >
              Close
            </button>
          </div>
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
                    {groups.map((group) => (
                      <optgroup key={group.parent} label={group.parent}>
                        {group.categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </optgroup>
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
                      <select
                        value={newParents[id] ?? UNGROUPED}
                        onChange={(event) => {
                          setNewParents((prev) => ({ ...prev, [id]: event.target.value }));
                          setTouched((prev) => ({ ...prev, [id]: true }));
                        }}
                        className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                      >
                        <option value={UNGROUPED}>Ungrouped</option>
                        {parentOptions.map((parent) => (
                          <option key={parent} value={parent}>
                            {parent}
                          </option>
                        ))}
                        <option value={NEW_PARENT_VALUE}>+ New parent</option>
                      </select>
                      {(newParents[id] ?? UNGROUPED) === NEW_PARENT_VALUE && (
                        <input
                          type="text"
                          placeholder="Parent name"
                          value={newParentNames[id] ?? ""}
                          onChange={(event) =>
                            setNewParentNames((prev) => ({ ...prev, [id]: event.target.value }))
                          }
                          className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                        />
                      )}
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
                    disabled={busyId === id || !selection || acceptingAll}
                    className="min-h-[44px] rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
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
