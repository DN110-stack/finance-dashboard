"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  totalCategoryUsage,
  useCategories,
  type Category,
  type CategoryUsage,
} from "../context/CategoriesContext";
import { useConfirm } from "../components/ConfirmDialog";
import { PARENT_CATEGORIES, distinctParents, groupCategoriesByParent, UNGROUPED } from "../lib/categories";

const USAGE_LABELS: [keyof CategoryUsage, string, string][] = [
  ["transactions", "transaction", "transactions"],
  ["budgets", "budget", "budgets"],
  ["budget_groups", "group budget", "group budgets"],
  ["annual_budgets", "annual budget", "annual budgets"],
  ["goals", "goal", "goals"],
  ["bills", "bill", "bills"],
];

// "12 transactions, 1 budget, 2 bills" — only the kinds that are non-zero.
function describeUsage(usage: CategoryUsage): string {
  return USAGE_LABELS.filter(([key]) => usage[key] > 0)
    .map(([key, singular, plural]) => `${usage[key]} ${usage[key] === 1 ? singular : plural}`)
    .join(", ");
}

const DEFAULT_COLOUR = "#3b82f6";
const NEW_PARENT_VALUE = "__new_parent__";

// The colour a newly chosen parent should hand down to a new custom
// category — the parent's own category row if it has one (core categories
// are self-parented), else an existing child's colour so the group stays
// visually consistent, else the generic default.
function colourForParent(parentName: string, categories: Category[]): string {
  const ownRow = categories.find((c) => c.name.toLowerCase() === parentName.toLowerCase());
  if (ownRow) return ownRow.colour;

  const childRow = categories.find(
    (c) => (c.parentCategory ?? "").toLowerCase() === parentName.toLowerCase()
  );
  if (childRow) return childRow.colour;

  return DEFAULT_COLOUR;
}

function resolveParentCategory(selection: string, newParentName: string): string | null {
  if (selection === UNGROUPED) return null;
  if (selection === NEW_PARENT_VALUE) return newParentName.trim() || null;
  return selection;
}

export default function CategoriesManager() {
  const { categories, isLoading, addCategory, updateCategory, getCategoryUsage, deleteCategory } =
    useCategories();
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [colour, setColour] = useState(DEFAULT_COLOUR);
  const [colourTouched, setColourTouched] = useState(false);
  const [parentSelection, setParentSelection] = useState<string>(UNGROUPED);
  const [newParentName, setNewParentName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Set while the "this category is still in use — move its records" dialog is open.
  const [moveDialog, setMoveDialog] = useState<{
    category: Category;
    usage: CategoryUsage;
    targetId: string;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColour, setEditColour] = useState(DEFAULT_COLOUR);
  const [editParentSelection, setEditParentSelection] = useState<string>(UNGROUPED);
  const [editNewParentName, setEditNewParentName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const parentOptions = useMemo(() => distinctParents(categories), [categories]);

  // The 11 core categories are seeded for every user and shown as a fixed,
  // read-only set; anything else is a category the user created themselves.
  const coreCategories = useMemo(
    () =>
      PARENT_CATEGORIES.map((coreName) => categories.find((c) => c.name === coreName)).filter(
        (c): c is Category => !!c
      ),
    [categories]
  );
  const customCategories = useMemo(
    () => categories.filter((c) => !(PARENT_CATEGORIES as readonly string[]).includes(c.name)),
    [categories]
  );
  const customGroups = useMemo(() => groupCategoriesByParent(customCategories), [customCategories]);

  function handleParentChange(value: string) {
    setParentSelection(value);
    // Only auto-follow the parent's colour until the user has manually
    // picked one themselves for this new category.
    if (colourTouched) return;
    if (value === UNGROUPED || value === NEW_PARENT_VALUE) {
      setColour(DEFAULT_COLOUR);
    } else {
      setColour(colourForParent(value, categories));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;

    const parentCategory = resolveParentCategory(parentSelection, newParentName);

    setIsSubmitting(true);
    setError(null);
    try {
      await addCategory(name.trim(), colour, parentCategory);
      setName("");
      setColour(DEFAULT_COLOUR);
      setColourTouched(false);
      setParentSelection(UNGROUPED);
      setNewParentName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    setError(null);
    setDeletingId(id);
    try {
      const usage = await getCategoryUsage(id);

      if (totalCategoryUsage(usage) > 0) {
        // Still in use — never delete out from under its records. Ask where
        // they should go instead.
        const firstOther = categories.find((c) => c.id !== id);
        setMoveDialog({ category, usage, targetId: firstOther?.id ?? "" });
        return;
      }

      const confirmed = await confirm({
        title: "Delete category?",
        message: `Delete "${category.name}"? Nothing uses it.`,
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!confirmed) return;

      await deleteCategory(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleConfirmMove() {
    if (!moveDialog || !moveDialog.targetId) return;

    setError(null);
    setDeletingId(moveDialog.category.id);
    try {
      await deleteCategory(moveDialog.category.id, moveDialog.targetId);
      setMoveDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete category");
      setMoveDialog(null);
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditColour(category.colour);
    setEditParentSelection(category.parentCategory ?? UNGROUPED);
    setEditNewParentName("");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleSaveEdit(category: Category) {
    const trimmedName = editName.trim();
    if (!trimmedName) return;

    const parentCategory = resolveParentCategory(editParentSelection, editNewParentName);
    const nameChanged = trimmedName.toLowerCase() !== category.name.toLowerCase();

    if (nameChanged) {
      // The database rewrites every reference to the old name, so tell the
      // user how far a rename reaches before it happens.
      try {
        const usage = await getCategoryUsage(category.id);
        if (totalCategoryUsage(usage) > 0) {
          const confirmed = await confirm({
            title: "Rename category?",
            message: `Renaming "${category.name}" to "${trimmedName}" will also update ${describeUsage(usage)}.`,
            confirmLabel: "Rename",
          });
          if (!confirmed) return;
        }
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to check category usage");
        return;
      }
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      await updateCategory(category.id, { name: trimmedName, colour: editColour, parentCategory });
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update category");
    } finally {
      setIsSavingEdit(false);
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
          <label htmlFor="category-parent" className="text-sm font-medium">
            Parent
          </label>
          <select
            id="category-parent"
            value={parentSelection}
            onChange={(event) => handleParentChange(event.target.value)}
            className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
          >
            <option value={UNGROUPED}>Ungrouped</option>
            {parentOptions.map((parent) => (
              <option key={parent} value={parent}>
                {parent}
              </option>
            ))}
            <option value={NEW_PARENT_VALUE}>+ New parent</option>
          </select>
        </div>

        {parentSelection === NEW_PARENT_VALUE && (
          <div className="flex flex-col gap-1">
            <label htmlFor="category-new-parent" className="text-sm font-medium">
              New parent name
            </label>
            <input
              id="category-new-parent"
              type="text"
              value={newParentName}
              onChange={(event) => setNewParentName(event.target.value)}
              placeholder="e.g. Education"
              className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="category-colour" className="text-sm font-medium">
            Colour
          </label>
          <div className="flex items-center gap-2">
            <input
              id="category-colour"
              type="color"
              value={colour}
              onChange={(event) => {
                setColour(event.target.value);
                setColourTouched(true);
              }}
              className="h-9 w-14 cursor-pointer rounded-md border border-black/10 bg-transparent p-1 dark:border-white/10"
            />
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-black/10 dark:border-white/10"
              style={{ backgroundColor: colour }}
              aria-hidden="true"
            />
          </div>
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

      {isLoading ? (
        <p className="rounded-lg border border-black/10 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          Loading categories…
        </p>
      ) : categories.length === 0 ? (
        <p className="rounded-lg border border-black/10 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          No categories yet. Add one above, or create one while reviewing uncategorised
          transactions.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          <div>
            <h2 className="mb-3 text-lg font-semibold">Core Categories</h2>
            <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
              {coreCategories.map((category) => (
                <li key={category.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: category.colour }}
                  />
                  <span className="text-sm font-medium">{category.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Custom Categories</h2>
            {customCategories.length === 0 ? (
              <p className="rounded-lg border border-black/10 p-4 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                No custom categories yet. Add one above, or create one while reviewing
                uncategorised transactions.
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {customGroups.map((group) => (
                  <div
                    key={group.parent}
                    className="rounded-lg border border-black/10 dark:border-white/10"
                  >
                    <h3 className="border-b border-black/10 px-4 py-2 text-sm font-semibold dark:border-white/10">
                      {group.parent}
                    </h3>
                    <ul className="divide-y divide-black/10 dark:divide-white/10">
                      {group.categories.map((category) => (
                        <li key={category.id} className="px-4 py-3">
                          {editingId === category.id ? (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                handleSaveEdit(category);
                              }}
                              className="flex flex-wrap items-end gap-3"
                            >
                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  Name
                                </label>
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(event) => setEditName(event.target.value)}
                                  required
                                  className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  Parent
                                </label>
                                <select
                                  value={editParentSelection}
                                  onChange={(event) => setEditParentSelection(event.target.value)}
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
                              </div>

                              {editParentSelection === NEW_PARENT_VALUE && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                    New parent name
                                  </label>
                                  <input
                                    type="text"
                                    value={editNewParentName}
                                    onChange={(event) => setEditNewParentName(event.target.value)}
                                    className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                                  />
                                </div>
                              )}

                              <div className="flex flex-col gap-1">
                                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                  Colour
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={editColour}
                                    onChange={(event) => setEditColour(event.target.value)}
                                    className="h-8 w-12 cursor-pointer rounded-md border border-black/10 bg-transparent p-1 dark:border-white/10"
                                  />
                                  <span
                                    className="h-6 w-6 shrink-0 rounded-full border border-black/10 dark:border-white/10"
                                    style={{ backgroundColor: editColour }}
                                    aria-hidden="true"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="submit"
                                  disabled={isSavingEdit || !editName.trim()}
                                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {isSavingEdit ? "Saving…" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  disabled={isSavingEdit}
                                  className="text-sm text-zinc-500 hover:underline disabled:opacity-50 dark:text-zinc-400"
                                >
                                  Cancel
                                </button>
                              </div>

                              {editError && (
                                <p className="w-full text-sm text-red-600 dark:text-red-400">
                                  {editError}
                                </p>
                              )}
                            </form>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span
                                  className="h-3 w-3 shrink-0 rounded-full"
                                  style={{ backgroundColor: category.colour }}
                                />
                                <span className="text-sm font-medium">{category.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => startEdit(category)}
                                  aria-label={`Edit ${category.name}`}
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(category.id)}
                                  disabled={deletingId === category.id}
                                  aria-label={`Delete ${category.name}`}
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {moveDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          onClick={() => setMoveDialog(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-black/10 bg-background p-5 shadow-xl dark:border-white/10"
          >
            <h2 className="text-base font-semibold">&ldquo;{moveDialog.category.name}&rdquo; is still in use</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              It&apos;s used by {describeUsage(moveDialog.usage)}. Choose a category to move them to
              before deleting it.
            </p>
            <label className="mt-4 flex flex-col gap-1 text-sm font-medium">
              Move to
              <select
                value={moveDialog.targetId}
                onChange={(event) => setMoveDialog({ ...moveDialog, targetId: event.target.value })}
                className="rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/10"
              >
                {categories
                  .filter((c) => c.id !== moveDialog.category.id)
                  .map((c) => (
                    <option key={c.id} value={c.id} className="text-zinc-900">
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setMoveDialog(null)}
                className="min-h-[44px] flex-1 rounded-md border border-black/10 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmMove}
                disabled={!moveDialog.targetId}
                className="min-h-[44px] flex-1 rounded-md bg-red-600 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Move and delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
