export type CategoryKind = "income" | "expense" | "transfer";

export const CATEGORY_KINDS: CategoryKind[] = ["income", "expense", "transfer"];

export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

export const CATEGORY_KIND_HINTS: Record<CategoryKind, string> = {
  income: "Money coming in that counts as income.",
  expense: "Everyday spending.",
  transfer: "Moves between your own accounts or pays off a card — left out of income, spending and savings figures.",
};

type KindedCategory = { name: string; kind: CategoryKind };

// Lower-cased names of every category classified as a transfer.
export function transferCategoryNames(categories: KindedCategory[]): Set<string> {
  return new Set(categories.filter((c) => c.kind === "transfer").map((c) => c.name.toLowerCase()));
}

// What a new category under `parentName` should default to: the parent's own
// row if it has one (core categories are self-parented), else its siblings'
// shared kind, else expense.
export function defaultKindForParent(
  parentName: string | null,
  categories: (KindedCategory & { parentCategory: string | null })[]
): CategoryKind {
  if (!parentName) return "expense";
  const target = parentName.toLowerCase();

  const ownRow = categories.find((c) => c.name.toLowerCase() === target);
  if (ownRow) return ownRow.kind;

  const siblings = categories.filter((c) => (c.parentCategory ?? "").toLowerCase() === target);
  if (siblings.length > 0 && siblings.every((c) => c.kind === siblings[0].kind)) {
    return siblings[0].kind;
  }

  return "expense";
}
