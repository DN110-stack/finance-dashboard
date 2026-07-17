"use client";

import { useEffect, useRef, useState } from "react";
import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";
import { Flame, Send, Sparkles } from "lucide-react";
import { useTransactions } from "../context/TransactionsContext";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatMode = "chat" | "roast";

const SUGGESTED_QUESTIONS = [
  "How much did I spend on food this month?",
  "What's my biggest expense?",
  "How much did I earn vs spend?",
];

const ROAST_PROMPT = "Roast my spending habits.";

export default function ChatPanel() {
  const { transactions } = useTransactions();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function askQuestion(question: string, mode: ChatMode = "chat") {
    if (!question.trim() || isStreaming) return;

    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    function appendToAnswer(delta: string) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: next[next.length - 1].content + delta,
        };
        return next;
      });
    }

    try {
      // One-off transactions are excluded from AI analysis, same as every
      // other dashboard calculation — they're a distraction from the user's
      // normal spending pattern, not part of it.
      const analyzedTransactions = transactions.filter((t) => !t.isOneOff);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, transactions: analyzedTransactions, mode }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to reach the assistant");
      }

      const stream = MessageStream.fromReadableStream(response.body);
      stream.on("text", appendToAnswer);
      await stream.done();
    } catch {
      setError("Something went wrong answering that question. Please try again.");
    } finally {
      setIsStreaming(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    askQuestion(input);
  }

  return (
    <div className="mt-6 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold">Ask about your transactions</h2>
        </div>
        <button
          type="button"
          onClick={() => askQuestion(ROAST_PROMPT, "roast")}
          disabled={isStreaming}
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-500/20 disabled:opacity-50 dark:text-orange-400"
        >
          <Flame className="h-4 w-4" />
          Roast my spending 🔥
        </button>
      </div>

      <div ref={scrollRef} className="mt-4 max-h-96 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => askQuestion(question)}
                  className="rounded-full border border-black/10 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/10"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-black/5 text-zinc-900 dark:bg-white/10 dark:text-zinc-100"
              }`}
            >
              {message.content || (isStreaming && index === messages.length - 1 ? "…" : "")}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question about your spending…"
          disabled={isStreaming}
          className="min-h-[44px] flex-1 rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60 dark:border-white/10"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="flex min-h-[44px] items-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          Send
        </button>
      </form>
    </div>
  );
}
