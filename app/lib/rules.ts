export const UNCATEGORIZED = "Uncategorized";

export type RuleMatchType = "contains" | "starts_with" | "regex";
export type RuleAmountSign = "any" | "debit" | "credit";

export const RULE_MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  contains: "Contains",
  starts_with: "Starts with",
  regex: "Regex",
};

export const RULE_AMOUNT_SIGN_LABELS: Record<RuleAmountSign, string> = {
  any: "Any amount",
  debit: "Debits only",
  credit: "Credits only",
};

// A categorisation rule. `pattern` lives in the transaction_rules.keyword
// column (the table predates match types and was extended in place).
export type CategoryRule = {
  id: string;
  pattern: string;
  matchType: RuleMatchType;
  amountSign: RuleAmountSign;
  categoryId: string | null;
  categoryName: string | null; // null if the category has since been deleted
  priority: number; // lower numbers are checked first
  enabled: boolean;
  wholeWord: boolean; // contains only: don't match inside a longer word
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, "i");
    return true;
  } catch {
    return false;
  }
}

type CompiledRule = {
  rule: CategoryRule;
  test: (description: string, amount: number) => boolean;
};

function compileRule(rule: CategoryRule): CompiledRule | null {
  if (!rule.enabled || !rule.categoryName) return null;

  const pattern = rule.matchType === "regex" ? rule.pattern : rule.pattern.trim();
  if (!pattern) return null;

  let matchesText: (description: string) => boolean;
  if (rule.matchType === "regex") {
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, "i");
    } catch {
      return null; // an invalid regex never matches rather than breaking imports
    }
    matchesText = (description) => regex.test(description);
  } else if (rule.matchType === "starts_with") {
    const lower = pattern.toLowerCase();
    matchesText = (description) => description.trim().toLowerCase().startsWith(lower);
  } else if (rule.wholeWord) {
    // Letters on either side break the match ("AGL" must not hit "AGLOW"),
    // but digits and punctuation don't — merchant references run into names.
    const regex = new RegExp(`(^|[^a-z])${escapeRegex(pattern)}($|[^a-z])`, "i");
    matchesText = (description) => regex.test(description);
  } else {
    const lower = pattern.toLowerCase();
    matchesText = (description) => description.toLowerCase().includes(lower);
  }

  return {
    rule,
    test: (description, amount) => {
      if (rule.amountSign === "debit" && !(amount < 0)) return false;
      if (rule.amountSign === "credit" && !(amount > 0)) return false;
      return matchesText(description);
    },
  };
}

// Lowest priority number first; on a tie the longer (more specific) pattern
// wins, then id so the order is stable.
function compareRules(a: CategoryRule, b: CategoryRule): number {
  if (a.priority !== b.priority) return a.priority - b.priority;
  if (a.pattern.length !== b.pattern.length) return b.pattern.length - a.pattern.length;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortRules(rules: CategoryRule[]): CategoryRule[] {
  return [...rules].sort(compareRules);
}

// Compile once, then match many transactions — regexes are built a single
// time rather than per transaction.
export function createRuleMatcher(rules: CategoryRule[]) {
  const compiled = sortRules(rules)
    .map(compileRule)
    .filter((entry): entry is CompiledRule => entry !== null);

  return {
    // The first matching rule by priority, or null.
    findRule(description: string, amount: number): CategoryRule | null {
      for (const entry of compiled) {
        if (entry.test(description, amount)) return entry.rule;
      }
      return null;
    },
  };
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
