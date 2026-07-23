import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import z from "zod";
import { searchChunks } from "@/features/knowledge/server/embeddings";
import { createTRPCRouter, ownerProcedure } from "@/trpc/init";

const CHAT_MODEL = "gpt-5.4-mini";
const CHAT_MAX_CHARS = 8_000;

// How many note chunks to pull into context for each turn.
const RETRIEVAL_LIMIT = 8;

const CHAT_SYSTEM_PROMPT = `You are Jarvis, the assistant inside Zo's personal operating system — a knowledge hub of notes across Learnings, Career, Projects, and AI Workflows.

Be concise, direct, and genuinely helpful. Use GitHub-flavored Markdown for structure (headings, lists, code blocks) when it aids clarity. When you are unsure, say so rather than inventing facts.`;

/**
 * Wraps the retrieved note chunks into a context block for the system prompt.
 * Each source is numbered and labeled with its note title + section so the model
 * can cite it by name.
 */
const buildContextBlock = (chunks: Awaited<ReturnType<typeof searchChunks>>) =>
  chunks.map((chunk, index) => `[${index + 1}] ${chunk.title} · ${chunk.section}\n${chunk.content}`).join("\n\n");

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(CHAT_MAX_CHARS),
});

export const chatRouter = createTRPCRouter({
  /**
   * A single non-streaming turn: takes the running transcript and returns the
   * assistant's next reply. Owner-only so the app's OpenAI key is never exposed
   * to read-only visitors.
   *
   * RAG: before answering, we semantically search the owner's notes with the
   * latest user message and inject the top matches into the system prompt. The
   * matched notes are returned as `sources` so the UI can link back to them.
   * Locked notes (and their subtree) are never retrieved — see searchChunks.
   */
  send: ownerProcedure.input(z.object({ messages: z.array(messageSchema).min(1).max(50) })).mutation(async ({ ctx, input }) => {
    const startedAt = performance.now();
    const lastUserMessage = [...input.messages].reverse().find((message) => message.role === "user");

    // Everything the vector search returned. Later steps (reranking, score
    // cutoffs) will narrow this down, so we keep the full set to trace how many
    // candidates we saw vs. how many actually made it into the prompt.
    const retrievalStart = performance.now();
    const candidates = lastUserMessage
      ? await searchChunks({
          userId: ctx.auth.user.id,
          query: lastUserMessage.content,
          // Chat is owner-only, so the authenticated owner can retrieve their
          // locked notes too; locked content is only hidden from non-owners.
          isOwner: ctx.isOwner,
          limit: RETRIEVAL_LIMIT,
        })
      : [];
    const retrievalDurationMs = Math.round(performance.now() - retrievalStart);

    // The chunks actually injected into the prompt. For now that's every
    // candidate; once reranking lands this becomes a filtered subset.
    const chunks = candidates;

    const context = buildContextBlock(chunks);
    const system = context
      ? `${CHAT_SYSTEM_PROMPT}

Use the notes below — the user's own knowledge base — to answer when they're relevant, and cite them by title. If they don't cover the question, say so and answer from general knowledge.

--- NOTES ---
${context}
--- END NOTES ---`
      : CHAT_SYSTEM_PROMPT;

    // Distinct source notes (a note can contribute several chunks), preserving
    // the relevance order from the search.
    const sources = [
      ...new Map(chunks.map((chunk) => [chunk.nodeId, { id: chunk.nodeId, title: chunk.title, section: chunk.section }])).values(),
    ];

    try {
      const generationStart = performance.now();
      const result = await generateText({
        model: openai(CHAT_MODEL),
        system,
        messages: input.messages,
        // temperature: 0.4,
        maxOutputTokens: 2048,
        timeout: { totalMs: 30_000 },
      });
      const generationDurationMs = Math.round(performance.now() - generationStart);

      const { text, usage, finishReason, warnings } = result;

      // A structured record of how this turn was built: token spend, why the
      // model stopped, and how retrieval fed the prompt. Returned to the client
      // so the chat can surface "how I got here"; persistence/eval come later.
      const trace = {
        model: CHAT_MODEL,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        finishReason,
        warnings,
        retrievedChunkCount: candidates.length,
        includedChunkCount: chunks.length,
        sourceCount: sources.length,
        retrievalDurationMs,
        generationDurationMs,
        totalDurationMs: Math.round(performance.now() - startedAt),
      };

      return { text, sources, trace };
    } catch (error) {
      console.error("chat.send failed", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Could not reach the assistant. Please try again.",
      });
    }
  }),
});
