export const UNCATEGORIZED = "Uncategorized";

export type RuleWithCategory = {
  keyword: string;
  categories: { name: string } | { name: string }[] | null;
};

function categoryNameFromRule(rule: RuleWithCategory): string | null {
  if (!rule.categories) return null;
  return Array.isArray(rule.categories) ? (rule.categories[0]?.name ?? null) : rule.categories.name;
}

// Matches a transaction description against the user's saved rules. When
// multiple rules match, the longest keyword wins as the more specific match.
export function matchCategoryForDescription(
  description: string,
  rules: RuleWithCategory[]
): string | null {
  const normalizedDescription = description.toLowerCase();
  let bestMatch: { keyword: string; categoryName: string } | null = null;

  for (const rule of rules) {
    const keyword = rule.keyword?.trim().toLowerCase();
    if (!keyword || !normalizedDescription.includes(keyword)) continue;

    const categoryName = categoryNameFromRule(rule);
    if (!categoryName) continue;

    if (!bestMatch || keyword.length > bestMatch.keyword.length) {
      bestMatch = { keyword, categoryName };
    }
  }

  return bestMatch?.categoryName ?? null;
}

// Extracts a short keyword from a transaction description for a new rule —
// the first couple of non-numeric words (merchant names), so it still
// matches the same merchant next time even if reference numbers change.
export function extractKeyword(description: string): string {
  const words = description
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0 && !/^\d+$/.test(word));

  const keyword = words.slice(0, 2).join(" ") || description.trim();
  return keyword.slice(0, 60);
}
