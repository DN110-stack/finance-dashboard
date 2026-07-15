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
              description:
                "The best-fitting category name, copied exactly (same spelling and case) from the user's existing categories list",
            },
          },
          required: ["index", "category"],
        },
      },
    },
    required: ["suggestions"],
  },
};

// AI suggestions only ever pick from the user's existing categories — never
// invent new ones. New categories are something the user creates explicitly
// through the "+ New category" flows elsewhere in the app.
function buildSystemPrompt(existingCategories: string[]): string {
  const categoryList = existingCategories.join(", ");

  return [
    "You are a financial assistant that categorizes bank transactions.",
    `The user's existing categories are: ${categoryList}.`,
    "For each transaction description, choose the single best-fitting category from that exact list.",
    "You must respond with one of those exact category names, copied exactly as written (same spelling and case) — never invent, rename, or pluralize a category, and never propose a category that isn't in the list.",
    "If nothing fits well, choose the closest reasonable match from the list rather than making one up.",
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

  // Nothing to suggest *from* — without existing categories there's no valid
  // answer the model could give, so don't even ask it to guess.
  if (descriptions.length === 0 || existingCategories.length === 0) {
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

      // Never trust the model to only return existing categories — verify
      // it ourselves and drop anything that isn't an exact (case-insensitive)
      // match, rather than let a hallucinated category through. Snap to the
      // existing category's exact casing so downstream matching works.
      const existingMatch = existingCategories.find(
        (c) => c.toLowerCase() === trimmedCategory.toLowerCase()
      );
      if (!existingMatch) continue;

      seenIndices.add(index);
      suggestions.push({
        index,
        description,
        category: existingMatch,
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
