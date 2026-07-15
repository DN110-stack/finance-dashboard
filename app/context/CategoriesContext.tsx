"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

export type Category = {
  id: string;
  name: string;
  colour: string;
  parentCategory: string | null;
};

type CategoryUpdates = {
  name: string;
  colour: string;
  parentCategory: string | null;
};

type CategoriesContextValue = {
  categories: Category[];
  isLoading: boolean;
  addCategory: (name: string, colour: string, parentCategory?: string | null) => Promise<Category>;
  updateCategory: (id: string, updates: CategoryUpdates) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
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
        .select("id, name, colour, parent_category")
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

  async function addCategory(name: string, colour: string, parentCategory: string | null = null) {
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
      .insert({ user_id: user.id, name: trimmedName, colour, parent_category: parentCategory })
      .select("id, name, colour, parent_category")
      .single();

    if (error) throw new Error(error.message);

    const category: Category = {
      id: data.id,
      name: data.name,
      colour: data.colour,
      parentCategory: data.parent_category,
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

    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .update({
        name: trimmedName,
        colour: updates.colour,
        parent_category: updates.parentCategory,
      })
      .eq("id", id)
      .select("id, name, colour, parent_category")
      .single();

    if (error) throw new Error(error.message);

    const category: Category = {
      id: data.id,
      name: data.name,
      colour: data.colour,
      parentCategory: data.parent_category,
    };

    setCategories((prev) => sortByName(prev.map((c) => (c.id === id ? category : c))));
    return category;
  }

  async function deleteCategory(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) throw new Error(error.message);

    setCategories((prev) => prev.filter((category) => category.id !== id));
  }

  return (
    <CategoriesContext.Provider
      value={{ categories, isLoading, addCategory, updateCategory, deleteCategory }}
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
