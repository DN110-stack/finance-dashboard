"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabase/client";
import { emitCategoryNameReplaced } from "../lib/categoryEvents";
import type { CategoryKind } from "../lib/categoryKind";

export type Category = {
  id: string;
  name: string;
  colour: string;
  parentCategory: string | null;
  kind: CategoryKind;
  coreKey: string | null;
  isHidden: boolean;
};

// How many records of each kind still reference a category by name.
export type CategoryUsage = {
  transactions: number;
  budgets: number;
  budget_groups: number;
  annual_budgets: number;
  goals: number;
  bills: number;
};

export function totalCategoryUsage(usage: CategoryUsage): number {
  return Object.values(usage).reduce((sum, count) => sum + count, 0);
}

type CategoryUpdates = {
  name: string;
  colour: string;
  parentCategory: string | null;
  kind: CategoryKind;
};

type CategoriesContextValue = {
  categories: Category[];
  // Everything except hidden categories — what pickers should offer.
  visibleCategories: Category[];
  isLoading: boolean;
  addCategory: (
    name: string,
    colour: string,
    parentCategory?: string | null,
    kind?: CategoryKind
  ) => Promise<Category>;
  updateCategory: (id: string, updates: CategoryUpdates) => Promise<Category>;
  getCategoryUsage: (id: string) => Promise<CategoryUsage>;
  // When anything still uses the category, `moveToId` names the category
  // that takes those records over — the database refuses the delete otherwise.
  deleteCategory: (id: string, moveToId?: string) => Promise<void>;
  setCategoryHidden: (id: string, hidden: boolean) => Promise<void>;
};

const CategoriesContext = createContext<CategoriesContextValue | null>(null);

function sortByName(categories: Category[]) {
  return [...categories].sort((a, b) => a.name.localeCompare(b.name));
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, colour, parent_category, kind, core_key, is_hidden")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (cancelled) return;

      if (!error && data) {
        setCategories(
          data.map((row) => ({
            id: row.id,
            name: row.name,
            colour: row.colour,
            parentCategory: row.parent_category,
            kind: row.kind,
            coreKey: row.core_key,
            isHidden: row.is_hidden,
          }))
        );
      }
      setIsLoading(false);
    }

    // A hard navigation/reload while this is in flight aborts the underlying
    // fetch; without a rejection handler that surfaces as an unhandled
    // promise rejection in the console even though `cancelled` already
    // guards against any resulting state update.
    load().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  async function addCategory(
    name: string,
    colour: string,
    parentCategory: string | null = null,
    kind: CategoryKind = "expense"
  ) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("You must be logged in to create a category");
    }

    const trimmedName = name.trim();

    // Never create a second category that only differs by case — hand back
    // the existing one instead so callers can still assign it.
    const existing = categories.find(
      (category) => category.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existing) return existing;

    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: user.id, name: trimmedName, colour, parent_category: parentCategory, kind })
      .select("id, name, colour, parent_category, kind, core_key, is_hidden")
      .single();

    if (error) throw new Error(error.message);

    const category: Category = {
      id: data.id,
      name: data.name,
      colour: data.colour,
      parentCategory: data.parent_category,
      kind: data.kind,
      coreKey: data.core_key,
      isHidden: data.is_hidden,
    };

    setCategories((prev) => sortByName([...prev, category]));
    return category;
  }

  async function updateCategory(id: string, updates: CategoryUpdates) {
    const trimmedName = updates.name.trim();

    // Never let a rename collide (case-insensitively) with a *different*
    // existing category — same duplicate-prevention rule as addCategory.
    const collision = categories.find(
      (category) => category.id !== id && category.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (collision) {
      throw new Error(`"${trimmedName}" already exists as a category`);
    }

    // One database call renames the category and rewrites every
    // transaction, budget, goal and bill that referenced the old name, in a
    // single transaction — so a partial failure can't leave them out of sync.
    const supabase = createClient();
    const { error } = await supabase.rpc("rename_category", {
      p_id: id,
      p_name: trimmedName,
      p_colour: updates.colour,
      p_parent: updates.parentCategory,
    });

    if (error) throw new Error(error.message);

    // `kind` isn't part of the rename function — it never affects other
    // tables, so it's a plain column update.
    const { error: kindError } = await supabase.from("categories").update({ kind: updates.kind }).eq("id", id);
    if (kindError) throw new Error(kindError.message);

    const previous = categories.find((c) => c.id === id);
    const category: Category = {
      id,
      name: trimmedName,
      colour: updates.colour,
      parentCategory: updates.parentCategory,
      kind: updates.kind,
      coreKey: previous?.coreKey ?? null,
      isHidden: previous?.isHidden ?? false,
    };

    if (previous && previous.name !== trimmedName) {
      emitCategoryNameReplaced(previous.name, trimmedName);
    }

    const renamedParent =
      previous && (previous.parentCategory ?? "").toLowerCase() === previous.name.toLowerCase();
    // The database renames a parent row's own parent label too (and its
    // children's), so mirror that here.
    const savedCategory = renamedParent ? { ...category, parentCategory: trimmedName } : category;

    setCategories((prev) =>
      sortByName(
        prev.map((c) => {
          if (c.id === id) return savedCategory;
          if (
            renamedParent &&
            previous &&
            (c.parentCategory ?? "").toLowerCase() === previous.name.toLowerCase()
          ) {
            return { ...c, parentCategory: trimmedName };
          }
          return c;
        })
      )
    );
    return savedCategory;
  }

  async function getCategoryUsage(id: string): Promise<CategoryUsage> {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("category_usage", { p_id: id });
    if (error) throw new Error(error.message);
    return data as CategoryUsage;
  }

  async function setCategoryHidden(id: string, hidden: boolean) {
    const supabase = createClient();
    const { error } = await supabase.rpc("set_category_hidden", { p_id: id, p_hidden: hidden });
    if (error) throw new Error(error.message);

    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isHidden: hidden } : c)));
  }

  async function deleteCategory(id: string, moveToId?: string) {
    const supabase = createClient();
    const { error } = await supabase.rpc("delete_category", {
      p_id: id,
      p_move_to: moveToId ?? null,
    });
    if (error) throw new Error(error.message);

    const deleted = categories.find((c) => c.id === id);
    const target = moveToId ? categories.find((c) => c.id === moveToId) : undefined;
    if (deleted && target) emitCategoryNameReplaced(deleted.name, target.name);

    setCategories((prev) => prev.filter((category) => category.id !== id));
  }

  const visibleCategories = useMemo(() => categories.filter((c) => !c.isHidden), [categories]);

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        visibleCategories,
        isLoading,
        addCategory,
        updateCategory,
        getCategoryUsage,
        deleteCategory,
        setCategoryHidden,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories must be used within a CategoriesProvider");
  }
  return context;
}
