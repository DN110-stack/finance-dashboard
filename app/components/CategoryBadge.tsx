import { getCategoryColor } from "../lib/categories";

export default function CategoryBadge({ category }: { category: string }) {
  const { badge } = getCategoryColor(category);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}
    >
      {category}
    </span>
  );
}
