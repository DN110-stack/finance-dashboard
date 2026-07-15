// `category` is always one of the user's existing category names — the API
// route never lets a suggestion through that isn't an exact match.
export type CategorySuggestion = {
  index: number;
  description: string;
  category: string;
};

const BATCH_SIZE = 50;
const MAX_CONCURRENT_BATCHES = 4;
const REQUEST_TIMEOUT_MS = 30_000;

// AI suggestions are an enhancement on top of rule-matching, not a hard
// requirement — any failure here (network, non-200, malformed JSON, timeout)
// just degrades to no suggestions rather than blocking the upload/review flow.
export async function fetchCategorySuggestions(
  descriptions: string[],
  categories: string[]
): Promise<CategorySuggestion[]> {
  if (descriptions.length === 0) return [];

  // Same merchant can appear hundreds of times — only ask the model once per
  // unique description, then fan the answer back out to every occurrence.
  const indicesByDescription = new Map<string, number[]>();
  descriptions.forEach((description, index) => {
    const indices = indicesByDescription.get(description);
    if (indices) indices.push(index);
    else indicesByDescription.set(description, [index]);
  });

  const uniqueDescriptions = Array.from(indicesByDescription.keys());
  const batches: string[][] = [];
  for (let i = 0; i < uniqueDescriptions.length; i += BATCH_SIZE) {
    batches.push(uniqueDescriptions.slice(i, i + BATCH_SIZE));
  }

  const batchResults = await runWithConcurrencyLimit(
    batches.map((batch) => () => fetchBatch(batch, categories)),
    MAX_CONCURRENT_BATCHES
  );

  const suggestions: CategorySuggestion[] = [];
  for (const batchSuggestions of batchResults) {
    for (const suggestion of batchSuggestions) {
      const indices = indicesByDescription.get(suggestion.description);
      if (!indices) continue;
      for (const index of indices) {
        suggestions.push({ ...suggestion, index });
      }
    }
  }
  return suggestions;
}

async function fetchBatch(
  descriptions: string[],
  categories: string[]
): Promise<CategorySuggestion[]> {
  try {
    const response = await fetch("/api/suggest-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptions, categories }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data?.suggestions) ? data.suggestions : [];
  } catch {
    return [];
  }
}

async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const current = nextIndex++;
      results[current] = await tasks[current]();
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}
