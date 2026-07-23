import { openai } from "@ai-sdk/openai";
import { propagateAttributes, startObservation } from "@langfuse/tracing";
import { context as otelContext, trace as otelTrace } from "@opentelemetry/api";
import { TRPCError } from "@trpc/server";
import { generateObject, streamText } from "ai";
import { after } from "next/server";
import z from "zod";
import { searchChunks } from "@/features/knowledge/server/embeddings";
import { langfuseSpanProcessor } from "@/instrumentation.node";
import { createTRPCRouter, ownerProcedure } from "@/trpc/init";

const CHAT_MODEL = "gpt-5.4-mini";
const CHAT_MAX_CHARS = 8_000;

// How many note chunks to pull into context for each turn.
const RETRIEVAL_LIMIT = 8;

// How many follow-up questions to suggest after each answer.
const FOLLOWUP_COUNT = 3;

const FOLLOWUP_SYSTEM_PROMPT = `You suggest follow-up questions the user might naturally ask next, given the conversation so far.

Rules:
- Write each one in the user's voice (first person), as if they typed it.
- Keep them short (under ~8 words) and immediately clickable.
- Make them distinct from each other and a genuine next step, not a rephrasing of what was just said.
- Prefer questions that dig deeper into the user's own notes and knowledge base.`;

const followupsSchema = z.object({
  followups: z.array(z.string().min(1).max(120)).length(FOLLOWUP_COUNT),
});

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
   * A single streaming turn: takes the running transcript and streams the
   * assistant's next reply. Owner-only so the app's OpenAI key is never exposed
   * to read-only visitors.
   *
   * Implemented as an async generator so the client can render tokens as they
   * arrive instead of waiting for the whole reply. It yields a discriminated
   * stream of events, in order:
   *   1. `sources` — the retrieved note links, emitted before generation so the
   *      UI can show them immediately.
   *   2. `delta`   — successive text chunks of the answer.
   *   3. `trace`   — the final "how I got here" metrics, once generation ends.
   *   4. `followups` — up to three suggested next questions, generated from the
   *      completed answer. Best-effort: skipped silently if it fails.
   *
   * RAG: before answering, we semantically search the owner's notes with the
   * latest user message and inject the top matches into the system prompt.
   * Locked notes (and their subtree) are never retrieved — see searchChunks.
   */
  send: ownerProcedure.input(z.object({ messages: z.array(messageSchema).min(1).max(50) })).mutation(async function* ({ ctx, input }) {
    const startedAt = performance.now();
    const lastUserMessage = [...input.messages].reverse().find((message) => message.role === "user");
    const userId = ctx.auth.user.id;

    // --- Langfuse: one trace per chat turn --------------------------------
    // This is a streaming async generator, so we can't wrap the whole turn in a
    // single `startActiveObservation` callback — its values are yielded out
    // across await points, which breaks the active-span context. Instead we open
    // a root span manually and capture an OTel context that carries both the
    // root span AND the trace-level attributes (user, tags). Re-entering that
    // context with `otelContext.with(...)` at each AI SDK call site parents that
    // call's telemetry spans under this turn's trace and stamps them with the
    // user id, even though the surrounding generator keeps yielding.
    let root!: ReturnType<typeof startObservation>;
    let turnContext = otelContext.active();
    propagateAttributes({ userId, tags: ["chat"] }, () => {
      root = startObservation("chat-turn", { input: lastUserMessage?.content }, { asType: "span" });
      turnContext = otelTrace.setSpan(otelContext.active(), root.otelSpan);
    });

    let answer: string | undefined;

    try {
      // Everything the vector search returned. Later steps (reranking, score
      // cutoffs) will narrow this down, so we keep the full set to trace how many
      // candidates we saw vs. how many actually made it into the prompt.
      const retrievalStart = performance.now();
      const candidates = lastUserMessage
        ? await otelContext.with(turnContext, async () => {
            const retriever = startObservation("retrieve-context", { input: lastUserMessage.content }, { asType: "retriever" });
            try {
              const results = await otelContext.with(otelTrace.setSpan(turnContext, retriever.otelSpan), () =>
                searchChunks({
                  userId,
                  query: lastUserMessage.content,
                  // Chat is owner-only, so the authenticated owner can retrieve their
                  // locked notes too; locked content is only hidden from non-owners.
                  isOwner: ctx.isOwner,
                  limit: RETRIEVAL_LIMIT,
                }),
              );
              // Log the matched notes (title/section/score) rather than the full
              // chunk text — that already lives on the generation's prompt.
              retriever.update({
                output: results.map((chunk) => ({ nodeId: chunk.nodeId, title: chunk.title, section: chunk.section, score: chunk.score })),
                metadata: { retrievedChunks: results.length, retrievalLimit: RETRIEVAL_LIMIT },
              });
              return results;
            } finally {
              retriever.end();
            }
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

      // Emit sources first so the UI can render citations before the answer lands.
      yield { type: "sources" as const, sources };

      try {
        const generationStart = performance.now();
        // Open `streamText` inside the turn context so its generation span (with
        // model, token usage, and cost) nests under the chat-turn trace.
        const result = otelContext.with(turnContext, () =>
          streamText({
            model: openai(CHAT_MODEL),
            system,
            messages: input.messages,
            // temperature: 0.4,
            maxOutputTokens: 2048,
            timeout: { totalMs: 30_000 },
            experimental_telemetry: {
              isEnabled: true,
              functionId: "generate-response",
              metadata: { retrievedChunks: candidates.length, includedChunks: chunks.length, sources: sources.length },
            },
          }),
        );

        // Time-to-first-token: how long the model took to start responding, as
        // distinct from how long the full answer took to stream. Captured on the
        // first delta and left null if the stream produced nothing.
        let firstTokenAt: number | null = null;
        for await (const delta of result.textStream) {
          firstTokenAt ??= performance.now();
          yield { type: "delta" as const, text: delta };
        }

        // These promises resolve once the stream above has fully drained.
        const [streamedAnswer, usage, finishReason, warnings] = await Promise.all([
          result.text,
          result.usage,
          result.finishReason,
          result.warnings,
        ]);
        answer = streamedAnswer;
        const generationDurationMs = Math.round(performance.now() - generationStart);
        const timeToFirstTokenMs = firstTokenAt === null ? null : Math.round(firstTokenAt - generationStart);

        // A structured record of how this turn was built: token spend, why the
        // model stopped, and how retrieval fed the prompt. Streamed to the client
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
          timeToFirstTokenMs,
          generationDurationMs,
          totalDurationMs: Math.round(performance.now() - startedAt),
        };

        yield { type: "trace" as const, trace };

        // Suggest a few next questions based on the full answer. Best-effort: a
        // failure here shouldn't sink a turn whose answer already streamed fine,
        // so we swallow errors and simply skip the suggestions.
        try {
          const { object } = await otelContext.with(turnContext, () =>
            generateObject({
              model: openai(CHAT_MODEL),
              schema: followupsSchema,
              system: FOLLOWUP_SYSTEM_PROMPT,
              messages: [...input.messages, { role: "assistant", content: answer ?? "" }],
              experimental_telemetry: { isEnabled: true, functionId: "suggest-followups" },
            }),
          );
          yield { type: "followups" as const, followups: object.followups };
        } catch (error) {
          console.error("chat.send followup generation failed", error);
        }
      } catch (error) {
        console.error("chat.send failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not reach the assistant. Please try again.",
        });
      }
    } finally {
      // Close the trace with the assistant's answer as the turn output, then
      // flush after the response so nothing is lost when the function freezes.
      root.update({ output: answer });
      root.end();
      after(() => langfuseSpanProcessor.forceFlush());
    }
  }),
});
