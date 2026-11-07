// A category name is stored on transactions, budgets, goals and bills, each
// held in its own context. When a category is renamed (or deleted with its
// records moved elsewhere), the database function rewrites all of those
// rows in one transaction — this tiny bus tells each context to apply the
// same rewrite to its in-memory copy, so the UI matches without a reload.

type Listener = (oldName: string, newName: string) => void;

const listeners = new Set<Listener>();

export function onCategoryNameReplaced(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitCategoryNameReplaced(oldName: string, newName: string) {
  listeners.forEach((listener) => listener(oldName, newName));
}

// Mirrors the case-insensitive match the database function uses.
export function replaceCategoryName<T extends string | null>(
  name: T,
  oldName: string,
  newName: string
): T | string {
  if (name !== null && name.toLowerCase() === oldName.toLowerCase()) return newName;
  return name;
}

// List version, matching replace_category_in_array: keeps order and drops the
// duplicate that replacing into an already-present name would create.
export function replaceCategoryInList(list: string[], oldName: string, newName: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of list) {
    const next = item.toLowerCase() === oldName.toLowerCase() ? newName : item;
    if (seen.has(next)) continue;
    seen.add(next);
    result.push(next);
  }
  return result;
}
