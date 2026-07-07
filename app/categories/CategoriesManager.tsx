"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useCategories } from "../context/CategoriesContext";

const DEFAULT_COLOUR = "#3b82f6";

export default function CategoriesManager() {
  const { categories, isLoading, addCategory, deleteCategory } = useCategories();
  const [name, setName] = useState("");
  const [colour, setColour] = useState(DEFAULT_COLOUR);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await addCategory(name.trim(), colour);
      setName("");
      setColour(DEFAULT_COLOUR);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setDeletingId(id);
    try {
      await deleteCategory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="category-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="category-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Groceries"
            required
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="category-colour" className="text-sm font-medium">
            Colour
          </label>
          <input
            id="category-colour"
            type="color"
            value={colour}
            onChange={(event) => setColour(event.target.value)}
            className="h-9 w-14 cursor-pointer rounded-md border border-black/10 bg-transparent p-1 dark:border-white/10"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? "Adding…" : "Add category"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="rounded-lg border border-black/10 dark:border-white/10">
        {isLoading ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">Loading categories…</p>
        ) : categories.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
            No categories yet. Add one above, or create one while reviewing uncategorised
            transactions.
          </p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {categories.map((category) => (
              <li key={category.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.colour }}
                  />
                  <span className="text-sm font-medium">{category.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(category.id)}
                  disabled={deletingId === category.id}
                  aria-label={`Delete ${category.name}`}
                  className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
