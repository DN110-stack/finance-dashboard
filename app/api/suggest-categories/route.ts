import Anthropic from "@anthropic-ai/sdk";
import type { CategorySuggestion } from "@/app/lib/categorySuggestions";

export const runtime = "nodejs";

const client = new Anthropic();

const SUGGEST_TOOL: Anthropic.Tool = {
  name: "suggest_categories",
  description: "Suggest a spending category for each transaction description, in the given order.",
  input_schema: {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: {
              type: "integer",
              description: "0-based index matching the input list order",
            },
            category: {
              type: "string",
              description: "Suggested category name, e.g. 'Groceries'",
            },
            isNewCategory: {
              type: "boolean",
              description: "true if this category name is NOT in the user's existing categories list",
            },
          },
          required: ["index", "category", "isNewCategory"],
        },
      },
    },
    required: ["suggestions"],
  },
};

function buildSystemPrompt(existingCategories: string[]): string {
  const categoryList = existingCategories.length > 0 ? existingCategories.join(", ") : "(none yet)";

  return [
    "You are a financial assistant that categorizes bank transactions.",
    `The user's existing categories are: ${categoryList}.`,
    "For each transaction description, suggest the single best-fitting category.",
    "Strongly prefer an existing category when it reasonably fits — match it exactly as written above.",
    "Only suggest a new category name when none of the existing ones fit well.",
    "New category names should be short (1-3 words), title case (e.g. 'Home Improvement'), and generic enough to reuse for similar future transactions — never a copy of the merchant name itself.",
    "Respond only by calling the suggest_categories tool, with exactly one entry per transaction, using its index.",
  ].join(" ");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const descriptions: string[] = Array.isArray(body?.descriptions)
    ? body.descriptions.filter((d: unknown): d is string => typeof d === "string")
    : [];
  const existingCategories: string[] = Array.isArray(body?.categories)
    ? body.categories.filter((c: unknown): c is string => typeof c === "string")
    : [];

  if (descriptions.length === 0) {
    return Response.json({ suggestions: [] satisfies CategorySuggestion[] });
  }

  const numberedList = descriptions.map((d, i) => `${i}. ${d}`).join("\n");

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(existingCategories),
      tools: [SUGGEST_TOOL],
      tool_choice: { type: "tool", name: "suggest_categories" },
      messages: [
        {
          role: "user",
          content: `Suggest a category for each of these ${descriptions.length} transactions:\n\n${numberedList}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    const rawSuggestions = Array.isArray((toolUse?.input as { suggestions?: unknown })?.suggestions)
      ? ((toolUse!.input as { suggestions: unknown[] }).suggestions)
      : [];

    const seenIndices = new Set<number>();
    const suggestions: CategorySuggestion[] = [];

    for (const raw of rawSuggestions) {
      if (typeof raw !== "object" || raw === null) continue;
      const { index, category } = raw as { index?: unknown; category?: unknown };
      if (typeof index !== "number" || typeof category !== "string") continue;
      if (seenIndices.has(index)) continue;

      const description = descriptions[index];
      if (description === undefined) continue;

      const trimmedCategory = category.trim();
      if (!trimmedCategory) continue;

      // Verify the "new category" claim ourselves rather than trusting the
      // model's boolean — snap to the existing category's exact casing if it
      // matches, so downstream matching (case-sensitive) works correctly.
      const existingMatch = existingCategories.find(
        (c) => c.toLowerCase() === trimmedCategory.toLowerCase()
      );

      seenIndices.add(index);
      suggestions.push({
        index,
        description,
        category: existingMatch ?? trimmedCategory,
        isNewCategory: !existingMatch,
      });
    }

    return Response.json({ suggestions });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to get category suggestions" },
      { status: 500 }
    );
  }
}
