"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useCategories } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "../lib/csv";
import { distinctParents, groupCategoriesByParent, UNGROUPED } from "../lib/categories";

const DEFAULT_COLOUR = "#3b82f6";
const NEW_CATEGORY_VALUE = "__new__";
const NEW_PARENT_VALUE = "__new_parent__";

export default function CategoryCell({ transaction }: { transaction: Transaction }) {
  const { categories, addCategory } = useCategories();
  const { assignCategory } = useTransactions();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState(DEFAULT_COLOUR);
  const [parentSelection, setParentSelection] = useState<string>(UNGROUPED);
  const [newParentName, setNewParentName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupCategoriesByParent(categories), [categories]);
  const parentOptions = useMemo(() => distinctParents(categories), [categories]);

  const currentCategory = categories.find(
    (c) => c.name.toLowerCase() === transaction.category.toLowerCase()
  );

  function flashSaved() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;

    if (value === NEW_CATEGORY_VALUE) {
      setError(null);
      setIsCreating(true);
      return;
    }

    const category = categories.find((c) => c.id === value);
    if (!category) return;

    setError(null);
    setIsSaving(true);
    try {
      await assignCategory(transaction, category);
      flashSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateAndAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;

    const parentCategory =
      parentSelection === UNGROUPED
        ? null
        : parentSelection === NEW_PARENT_VALUE
          ? newParentName.trim() || null
          : parentSelection;

    setError(null);
    setIsSaving(true);
    try {
      const category = await addCategory(newName.trim(), newColour, parentCategory);
      await assignCategory(transaction, category);
      setIsCreating(false);
      setNewName("");
      setNewColour(DEFAULT_COLOUR);
      setParentSelection(UNGROUPED);
      setNewParentName("");
      flashSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={currentCategory?.id ?? ""}
          onChange={handleChange}
          disabled={isSaving}
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:border-white/10"
        >
          {!currentCategory && (
            <option value="" disabled>
              {transaction.category}
            </option>
          )}
          {groups.map((group) => (
            <optgroup key={group.parent} label={group.parent}>
              {group.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={NEW_CATEGORY_VALUE}>+ Create new category</option>
        </select>

        {justSaved && (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Saved" />
        )}
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {isCreating && (
        <form onSubmit={handleCreateAndAssign} className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            autoFocus
            placeholder="Category name"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          />
          <select
            value={parentSelection}
            onChange={(event) => setParentSelection(event.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          >
            <option value={UNGROUPED}>Ungrouped</option>
            {parentOptions.map((parent) => (
              <option key={parent} value={parent}>
                {parent}
              </option>
            ))}
            <option value={NEW_PARENT_VALUE}>+ New parent</option>
          </select>
          {parentSelection === NEW_PARENT_VALUE && (
            <input
              type="text"
              placeholder="Parent name"
              value={newParentName}
              onChange={(event) => setNewParentName(event.target.value)}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            />
          )}
          <input
            type="color"
            value={newColour}
            onChange={(event) => setNewColour(event.target.value)}
            className="h-7 w-10 cursor-pointer rounded-md border border-black/10 bg-transparent p-1 dark:border-white/10"
          />
          <button
            type="submit"
            disabled={isSaving || !newName.trim()}
            className="rounded-md bg-blue-600 px-2 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setError(null);
            }}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}
