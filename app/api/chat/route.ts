import Anthropic from "@anthropic-ai/sdk";
import type { Transaction } from "@/app/lib/csv";

export const runtime = "nodejs";

const client = new Anthropic();

type ChatMode = "chat" | "roast";

function buildSystemPrompt(transactions: Transaction[], mode: ChatMode): string {
  const today = new Date().toISOString().slice(0, 10);

  const base = [
    `Today's date is ${today}.`,
    "You are a financial assistant with access to the user's transaction history.",
    "Only use the transaction data below to answer — never invent figures, merchants, or categories.",
    "Amounts are in dollars: positive values are income/credits, negative values are expenses/debits.",
  ];

  const toneInstructions =
    mode === "roast"
      ? [
          "The user wants a ROAST of their spending habits — funny, witty, a little savage, like a friendly comedy roast.",
          "Never be mean-spirited, shaming, or judgmental about their financial situation — keep it playful.",
          "Every joke must be tied to a real, specific detail from the data: an actual merchant name, category, dollar amount, date, or pattern (e.g. how often a category shows up, the single biggest purchase, a recurring subscription).",
          "Do not invent numbers or merchants that aren't in the data.",
          "End with one genuinely useful, honest insight or tip based on what you actually found.",
          "Keep it short and punchy — a few sentences or quick jabs, not a long essay.",
        ]
      : [
          "When asked about spending, income, or totals, sum the matching transactions yourself before answering.",
          "Keep answers concise and cite concrete numbers.",
        ];

  return [
    ...base,
    ...toneInstructions,
    "",
    "Transactions (JSON array of {date, description, category, amount}):",
    JSON.stringify(transactions),
  ].join("\n");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const transactions: Transaction[] = Array.isArray(body?.transactions) ? body.transactions : [];
  const mode: ChatMode = body?.mode === "roast" ? "roast" : "chat";

  if (!question) {
    return new Response("Missing question", { status: 400 });
  }

  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: buildSystemPrompt(transactions, mode),
    messages: [{ role: "user", content: question }],
  });

  return new Response(stream.toReadableStream(), {
    headers: { "Content-Type": "text/event-stream" },
  });
}
