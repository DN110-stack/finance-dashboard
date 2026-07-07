"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import CategoryBadge from "../components/CategoryBadge";
import { useCategories } from "../context/CategoriesContext";
import { useTransactions } from "../context/TransactionsContext";
import type { Transaction } from "../lib/csv";

const DEFAULT_COLOUR = "#3b82f6";
const ESTIMATED_MENU_HEIGHT = 220;

type Position = { left: number } & ({ top: number; bottom?: never } | { bottom: number; top?: never });

export default function CategoryCell({ transaction }: { transaction: Transaction }) {
  const { categories, addCategory } = useCategories();
  const { assignCategory } = useTransactions();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColour, setNewColour] = useState(DEFAULT_COLOUR);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  function closeMenu() {
    setIsOpen(false);
    setIsCreating(false);
    setError(null);
  }

  function toggleMenu() {
    if (isOpen) {
      closeMenu();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const opensAbove = rect.bottom + ESTIMATED_MENU_HEIGHT > window.innerHeight;
    setPosition(
      opensAbove
        ? { bottom: window.innerHeight - rect.top + 4, left: rect.left }
        : { top: rect.bottom + 4, left: rect.left }
    );
    setIsOpen(true);
  }

  // The menu is portaled to <body>, so a plain DOM-containment check needs to
  // look at both the trigger and the portaled popup — a click inside the
  // popup is not a DOM descendant of the trigger's wrapper.
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      closeMenu();
    }

    function handleScroll() {
      closeMenu();
    }

    document.addEventListener("mousedown", handleClickOutside);
    // capture: true — scroll events don't bubble, but this still catches
    // scrolling on the table's own scrollable ancestor, not just window.
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  function flashSaved() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  async function handleSelect(categoryId: string) {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    setError(null);
    setIsSaving(true);
    try {
      await assignCategory(transaction, category);
      closeMenu();
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

    setError(null);
    setIsSaving(true);
    try {
      const category = await addCategory(newName.trim(), newColour);
      await assignCategory(transaction, category);
      closeMenu();
      setNewName("");
      setNewColour(DEFAULT_COLOUR);
      flashSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleMenu}
        className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
      >
        <CategoryBadge category={transaction.category} />
        <ChevronDown className="h-3 w-3 text-zinc-400" />
      </button>

      {justSaved && (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Saved" />
      )}

      {isOpen &&
        position &&
        createPortal(
          <div
            ref={popupRef}
            style={
              "top" in position
                ? { top: position.top, left: position.left }
                : { bottom: position.bottom, left: position.left }
            }
            className="fixed z-50 w-56 rounded-md border border-black/10 bg-background p-1 shadow-lg dark:border-white/10"
          >
            {error && (
              <p className="px-2 py-1 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}

            {!isCreating ? (
              <>
                <ul className="max-h-48 overflow-y-auto">
                  {categories.map((category) => (
                    <li key={category.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(category.id)}
                        disabled={isSaving}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: category.colour }}
                        />
                        {category.name}
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="mt-1 w-full rounded px-2 py-1.5 text-left text-sm text-blue-600 hover:bg-black/5 dark:text-blue-400 dark:hover:bg-white/10"
                >
                  + Create new category
                </button>
              </>
            ) : (
              <form onSubmit={handleCreateAndAssign} className="flex flex-col gap-2 p-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Category name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  className="rounded-md border border-black/10 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/10"
                />
                <input
                  type="color"
                  value={newColour}
                  onChange={(event) => setNewColour(event.target.value)}
                  className="h-8 w-full cursor-pointer rounded-md border border-black/10 bg-transparent p-1 dark:border-white/10"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving || !newName.trim()}
                    className="flex-1 rounded-md bg-blue-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? "Saving…" : "Create & assign"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setError(null);
                    }}
                    className="rounded-md px-2 py-1.5 text-sm text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
