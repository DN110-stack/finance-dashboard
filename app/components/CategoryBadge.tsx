"use client";

import { useCategories } from "../context/CategoriesContext";
import { getCategoryColor } from "../lib/categories";

export default function CategoryBadge({ category }: { category: string }) {
  const { categories } = useCategories();
  const color = getCategoryColor(category, categories);

  if (color.badge) {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color.badge}`}
      >
        {category}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${color.hex}1a`, color: color.hex }}
    >
      {category}
    </span>
  );
}
