export type CategoryColorInfo = {
  // Tailwind classes for the stock category palette. Absent for custom
  // (user-picked hex) or unrecognized categories — callers should fall back
  // to an inline style using `hex` in that case.
  badge?: string;
  hex: string;
};

// Fixed display/legend order for the 11 preset parent categories — charts and
// grouped lists use this instead of alphabetical so a category's colour never
// shifts between renders as the set of categories present changes.
export const PARENT_CATEGORIES = [
  "Income",
  "Housing",
  "Food",
  "Transport",
  "Health",
  "Finance",
  "Shopping",
  "Entertainment",
  "Personal Care",
  "Savings",
  "Other",
] as const;

// Validated (dataviz skill categorical-palette checks, light + dark surfaces)
// hex per parent category, in the same fixed order as PARENT_CATEGORIES.
export const CATEGORY_COLORS: Record<string, CategoryColorInfo> = {
  Income: { hex: "#16a34a" },
  Housing: { hex: "#3b82f6" },
  Food: { hex: "#ea580c" },
  Transport: { hex: "#059669" },
  Health: { hex: "#ef4444" },
  Finance: { hex: "#d97706" },
  Shopping: { hex: "#ec4899" },
  Entertainment: { hex: "#8b5cf6" },
  "Personal Care": { hex: "#c026d3" },
  Savings: { hex: "#0d9488" },
  // Deliberately a low-chroma neutral — "Other" is a genuine catch-all
  // bucket, same rationale as DEFAULT_CATEGORY_COLOR below.
  Other: { hex: "#64748b" },
};

export const DEFAULT_CATEGORY_COLOR: CategoryColorInfo = {
  hex: "#71717a",
};

export function getCategoryColor(
  category: string,
  customCategories?: { name: string; colour: string }[]
): CategoryColorInfo {
  const custom = customCategories?.find(
    (c) => c.name.toLowerCase() === category.toLowerCase()
  );
  if (custom) {
    return { hex: custom.colour };
  }

  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR;
}

export const UNGROUPED = "Ungrouped";

export type CategoryWithParent = {
  id: string;
  name: string;
  colour: string;
  parentCategory: string | null;
};

// Groups categories under their parent, ordered PARENT_CATEGORIES first, then
// any custom parents alphabetically, then an "Ungrouped" bucket last.
// Categories within a group are sorted by name.
export function groupCategoriesByParent<T extends CategoryWithParent>(
  categories: T[]
): { parent: string; categories: T[] }[] {
  const byParent = new Map<string, T[]>();

  for (const category of categories) {
    const key = category.parentCategory?.trim() || UNGROUPED;
    const existing = byParent.get(key);
    if (existing) existing.push(category);
    else byParent.set(key, [category]);
  }

  const presetParents = PARENT_CATEGORIES.filter((parent) => byParent.has(parent));
  const customParents = Array.from(byParent.keys())
    .filter((parent) => parent !== UNGROUPED && !(PARENT_CATEGORIES as readonly string[]).includes(parent))
    .sort((a, b) => a.localeCompare(b));
  const orderedKeys = [...presetParents, ...customParents];
  if (byParent.has(UNGROUPED)) orderedKeys.push(UNGROUPED);

  return orderedKeys.map((parent) => ({
    parent,
    categories: [...byParent.get(parent)!].sort((a, b) => a.name.localeCompare(b.name)),
  }));
}

// All parent names available for a "parent" picker: the 11 presets (always
// offered, even before any categories exist) plus any custom parent names
// already in use, alphabetically after the presets.
export function distinctParents(categories: CategoryWithParent[]): string[] {
  const custom = new Set<string>();
  for (const category of categories) {
    const key = category.parentCategory?.trim();
    if (key && !(PARENT_CATEGORIES as readonly string[]).includes(key)) custom.add(key);
  }
  return [...PARENT_CATEGORIES, ...Array.from(custom).sort((a, b) => a.localeCompare(b))];
}

// Resolves a transaction's leaf category name to its parent group name, for
// rolling up per-leaf transactions into per-parent chart series. Falls back
// to the leaf name itself when it has no parent, or isn't a known category
// at all (e.g. "Uncategorized", or a category that's since been deleted).
export function resolveGroupName(
  categoryName: string,
  categories: CategoryWithParent[]
): string {
  const match = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  return match?.parentCategory?.trim() || categoryName;
}

// Orders a set of resolved group names for chart series/legends: preset
// parents first (in PARENT_CATEGORIES order), then anything else (custom
// parents, unmatched leaf names) alphabetically — so colour-to-series mapping
// stays fixed rather than shifting between renders.
export function orderByParentPriority(names: Iterable<string>): string[] {
  const set = new Set(names);
  const preset = PARENT_CATEGORIES.filter((parent) => set.has(parent));
  const rest = Array.from(set)
    .filter((name) => !(PARENT_CATEGORIES as readonly string[]).includes(name))
    .sort((a, b) => a.localeCompare(b));
  return [...preset, ...rest];
}
