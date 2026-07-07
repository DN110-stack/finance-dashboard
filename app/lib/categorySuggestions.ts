export type CategorySuggestion = {
  index: number;
  description: string;
  category: string;
  isNewCategory: boolean;
};

// AI suggestions are an enhancement on top of rule-matching, not a hard
// requirement — any failure here (network, non-200, malformed JSON) just
// degrades to no suggestions rather than blocking the upload/review flow.
export async function fetchCategorySuggestions(
  descriptions: string[],
  categories: string[]
): Promise<CategorySuggestion[]> {
  if (descriptions.length === 0) return [];

  try {
    const response = await fetch("/api/suggest-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptions, categories }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}
