export type CategoryColorInfo = {
  // Tailwind classes for the stock category palette. Absent for custom
  // (user-picked hex) or unrecognized categories — callers should fall back
  // to an inline style using `hex` in that case.
  badge?: string;
  hex: string;
};

export const CATEGORY_COLORS: Record<string, CategoryColorInfo> = {
  Food: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
    hex: "#f97316",
  },
  Rent: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    hex: "#3b82f6",
  },
  Transport: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    hex: "#10b981",
  },
  Entertainment: {
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    hex: "#a855f7",
  },
  Shopping: {
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
    hex: "#ec4899",
  },
  Income: {
    badge: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
    hex: "#22c55e",
  },
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
