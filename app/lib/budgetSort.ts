export type SortOption =
  | "percentDesc"
  | "percentAsc"
  | "amountDesc"
  | "amountAsc"
  | "nameAsc"
  | "nameDesc";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "percentDesc", label: "% Used (high to low)" },
  { value: "percentAsc", label: "% Used (low to high)" },
  { value: "amountDesc", label: "Amount (high to low)" },
  { value: "amountAsc", label: "Amount (low to high)" },
  { value: "nameAsc", label: "Name (A–Z)" },
  { value: "nameDesc", label: "Name (Z–A)" },
];

// Shared by both the Monthly and Annual budget card lists — both CardItem
// shapes carry name/amount/percent, whatever else differs between them.
export function sortCardItems<T extends { name: string; amount: number; percent: number }>(
  items: T[],
  sortOption: SortOption
): T[] {
  const sorted = [...items];
  switch (sortOption) {
    case "percentDesc":
      return sorted.sort((a, b) => b.percent - a.percent);
    case "percentAsc":
      return sorted.sort((a, b) => a.percent - b.percent);
    case "amountDesc":
      return sorted.sort((a, b) => b.amount - a.amount);
    case "amountAsc":
      return sorted.sort((a, b) => a.amount - b.amount);
    case "nameAsc":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "nameDesc":
      return sorted.sort((a, b) => b.name.localeCompare(a.name));
  }
}
