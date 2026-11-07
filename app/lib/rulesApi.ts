import { createClient } from "./supabase/client";
import type { CategoryRule, RuleAmountSign, RuleMatchType } from "./rules";

export type RuleInput = {
  pattern: string;
  matchType: RuleMatchType;
  amountSign: RuleAmountSign;
  categoryId: string;
  wholeWord: boolean;
  enabled: boolean;
};

export const RULE_COLUMNS =
  "id, keyword, category_id, match_type, amount_sign, priority, enabled, whole_word, categories(name)";

type RuleRow = {
  id: string;
  keyword: string;
  category_id: string | null;
  match_type: RuleMatchType;
  amount_sign: RuleAmountSign;
  priority: number;
  enabled: boolean;
  whole_word: boolean;
  categories: { name: string } | { name: string }[] | null;
};

export function ruleFromRow(row: RuleRow): CategoryRule {
  const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
  return {
    id: row.id,
    pattern: row.keyword,
    matchType: row.match_type,
    amountSign: row.amount_sign,
    categoryId: row.category_id,
    categoryName: category?.name ?? null,
    priority: row.priority,
    enabled: row.enabled,
    wholeWord: row.whole_word,
  };
}

async function requireUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be logged in to manage rules");
  return user.id;
}

export async function fetchRules(): Promise<CategoryRule[]> {
  const userId = await requireUserId();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transaction_rules")
    .select(RULE_COLUMNS)
    .eq("user_id", userId)
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as unknown as RuleRow[]).map(ruleFromRow);
}

// A new rule goes to the top: it's the most recent thing you told the app,
// so it should beat older, broader rules.
export async function createRule(input: RuleInput): Promise<CategoryRule> {
  const userId = await requireUserId();
  const supabase = createClient();

  const { data: top, error: topError } = await supabase
    .from("transaction_rules")
    .select("priority")
    .eq("user_id", userId)
    .order("priority", { ascending: true })
    .limit(1);
  if (topError) throw new Error(topError.message);

  const priority = (top?.[0]?.priority ?? 1) - 1;

  const { data, error } = await supabase
    .from("transaction_rules")
    .insert({
      user_id: userId,
      keyword: input.pattern.trim(),
      category_id: input.categoryId,
      match_type: input.matchType,
      amount_sign: input.amountSign,
      whole_word: input.wholeWord,
      enabled: input.enabled,
      priority,
    })
    .select(RULE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return ruleFromRow(data as unknown as RuleRow);
}

export async function updateRule(id: string, input: RuleInput): Promise<CategoryRule> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("transaction_rules")
    .update({
      keyword: input.pattern.trim(),
      category_id: input.categoryId,
      match_type: input.matchType,
      amount_sign: input.amountSign,
      whole_word: input.wholeWord,
      enabled: input.enabled,
    })
    .eq("id", id)
    .select(RULE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return ruleFromRow(data as unknown as RuleRow);
}

export async function setRuleEnabled(id: string, enabled: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("transaction_rules").update({ enabled }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteRule(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("transaction_rules").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// Rewrites priorities 1..n to match `orderedRules`, touching only the rows
// whose number actually changes.
export async function saveRuleOrder(orderedRules: CategoryRule[]): Promise<CategoryRule[]> {
  const supabase = createClient();
  const next = orderedRules.map((rule, index) => ({ ...rule, priority: index + 1 }));

  await Promise.all(
    next
      .filter((rule, index) => rule.priority !== orderedRules[index].priority)
      .map(async (rule) => {
        const { error } = await supabase
          .from("transaction_rules")
          .update({ priority: rule.priority })
          .eq("id", rule.id);
        if (error) throw new Error(error.message);
      })
  );

  return next;
}
