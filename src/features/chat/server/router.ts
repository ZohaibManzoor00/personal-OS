import { openai } from "@ai-sdk/openai";
import { propagateAttributes, startObservation } from "@langfuse/tracing";
import { context as otelContext, trace as otelTrace } from "@opentelemetry/api";
import { TRPCError } from "@trpc/server";
import { generateObject, generateText, stepCountIs, streamText } from "ai";
import { after } from "next/server";
import z from "zod";
import { langfuseSpanProcessor } from "@/instrumentation.node";
import { FOLLOWUP_SYSTEM_PROMPT } from "@/prompts/chat-followups";
import { SUMMARY_SYSTEM_PROMPT } from "@/prompts/chat-summary";
import { buildAgentSystemPrompt } from "@/prompts/chat-system";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import { createChatTools, type ToolSource } from "./tools";

const CHAT_MODEL = "gpt-5.4-mini";
const CHAT_MAX_CHARS = 8_000;

// Upper bound on the tool→answer loop for one turn. A step is one model call, so
// this caps how many tool round-trips the agent can take before it must answer,
// keeping latency and cost bounded.
const MAX_STEPS = 6;

// How many follow-up questions to suggest after each answer.
const FOLLOWUP_COUNT = 3;

const followupsSchema = z.object({
  followups: z.array(z.string().min(1).max(120)).length(FOLLOWUP_COUNT),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(CHAT_MAX_CHARS),
});

/** Turns a tool call into a one-line "what it's doing" label for the timeline. */
const toolLabel = (toolName: string, input: unknown): string => {
  const args = (input ?? {}) as Record<string, unknown>;
  switch (toolName) {
    case "searchNotes":
      return typeof args.query === "string"
        ? `Searching notes for “${args.query}”`
        : "Searching notes";
    case "browseTopics":
      return typeof args.section === "string"
        ? `Mapping ${args.section} notes`
        : "Mapping the knowledge base";
    case "listRecentNotes":
      return typeof args.days === "number"
        ? `Pulling notes from the last ${args.days} days`
        : "Pulling recent notes";
    case "keywordSearch":
      return typeof args.terms === "string"
        ? `Keyword search for “${args.terms}”`
        : "Keyword search";
    default:
      return "Working";
  }
};

/**
 * Reduces a tool's return value to what the timeline needs: how many items it
 * found and which cited notes it surfaced (for the per-step source chips). Note
 * tools return an array of `{ citation, noteId, title, section, ... }`;
 * `browseTopics` returns a `{ totalNotes, sections }` map with no citations.
 */
const summarizeToolResult = (
  output: unknown,
): { count: number; sources: ToolSource[] } => {
  if (Array.isArray(output)) {
    const sources: ToolSource[] = [];
    for (const item of output) {
      if (item && typeof item === "object" && "noteId" in item) {
        const rec = item as {
          noteId?: unknown;
          title?: unknown;
          section?: unknown;
        };
        if (
          typeof rec.noteId === "string" &&
          typeof rec.title === "string" &&
          typeof rec.section === "string"
        ) {
          sources.push({
            id: rec.noteId,
            title: rec.title,
            section: rec.section,
          });
        }
      }
    }
    return { count: output.length, sources };
  }
  if (output && typeof output === "object" && "totalNotes" in output) {
    const rec = output as { totalNotes?: unknown };
    if (typeof rec.totalNotes === "number")
      return { count: rec.totalNotes, sources: [] };
  }
  return { count: 0, sources: [] };
};

export const chatRouter = createTRPCRouter({
  /**
   * A single streaming turn as a tool-calling agent. Public — anyone (signed in
   * or not) can chat against the owner's knowledge base. Retrieval happens
   * through tools (see `createChatTools`), scoped to the owner's notes; locked
   * notes are only reachable when the owner themselves is asking (`isOwner`).
   *
   * Implemented as an async generator so the client can render the agent's work
   * live. It yields a discriminated stream of events:
   *   - `status`    — phase/step updates: `thinking`, each `tool-call` and its
   *     `tool-result` (with the notes that call surfaced), `generating`,
   *     `suggesting`. These drive the "chain of thought" timeline.
   *   - `sources`   — the cumulative, ordered note list (citation [n] ↔ chip).
   *   - `delta`     — successive text chunks of the answer.
   *   - `trace`     — final metrics once the answer ends.
   *   - `followups` — up to three suggested next questions. Best-effort.
   */
  send: publicProcedure
    .input(z.object({ messages: z.array(messageSchema).min(1).max(50) }))
    .mutation(async function* ({ ctx, input }) {
      const startedAt = performance.now();
      const lastUserMessage = [...input.messages]
        .reverse()
        .find((message) => message.role === "user");
      // Whose notes the tools search: always the owner's (the app is their
      // knowledge base). Who is asking, for tracing: the signed-in viewer if there
      // is one, otherwise the owner / an anonymous label.
      const ownerUserId = ctx.ownerUserId;
      const userId = ctx.session?.user.id ?? ownerUserId ?? "anonymous";

      // --- Langfuse: one trace per chat turn --------------------------------
      // A streaming generator yields across await points, which breaks the
      // active-span context, so we open a root span manually and capture an OTel
      // context carrying both the span and the trace-level attributes. Re-entering
      // it at each AI SDK call site parents that call's telemetry under this turn.
      let root!: ReturnType<typeof startObservation>;
      let turnContext = otelContext.active();
      propagateAttributes({ userId, tags: ["chat"] }, () => {
        root = startObservation(
          "chat-turn",
          { input: lastUserMessage?.content },
          { asType: "span" },
        );
        turnContext = otelTrace.setSpan(otelContext.active(), root.otelSpan);
      });

      let answer: string | undefined;

      try {
        // One citation registry per turn, shared across every tool the agent calls
        // (see createChatTools). `ownerUserId ?? ""` keeps types clean when there's
        // no owner account yet — the queries simply match nothing, and the agent
        // still answers general questions.
        const { tools, getSources } = createChatTools({
          ownerUserId: ownerUserId ?? "",
          isOwner: ctx.isOwner,
        });
        const system = buildAgentSystemPrompt();

        // First heartbeat so the UI shows movement before the model responds.
        yield { type: "status" as const, phase: "thinking" as const };

        const generationStart = performance.now();
        // Open `streamText` inside the turn context so the generation and tool
        // spans (model, token usage, cost) nest under the chat-turn trace.
        const result = otelContext.with(turnContext, () =>
          streamText({
            model: openai(CHAT_MODEL),
            system,
            messages: input.messages,
            tools,
            stopWhen: stepCountIs(MAX_STEPS),
            maxOutputTokens: 2048,
            timeout: { totalMs: 45_000 },
            experimental_telemetry: {
              isEnabled: true,
              functionId: "chat-agent",
            },
          }),
        );

        // Time-to-first-token: when the model started producing the *answer* text,
        // as distinct from tool-calling. Null if nothing streamed.
        let firstTokenAt: number | null = null;
        let generatingEmitted = false;
        let toolCallCount = 0;

        // fullStream carries tool calls/results interleaved with text, so we can
        // narrate the agent's work step by step instead of just streaming tokens.
        for await (const part of result.fullStream) {
          if (part.type === "tool-call") {
            toolCallCount += 1;
            yield {
              type: "status" as const,
              phase: "tool-call" as const,
              toolCallId: part.toolCallId,
              tool: part.toolName,
              label: toolLabel(part.toolName, part.input),
            };
          } else if (part.type === "tool-result") {
            const { count, sources } = summarizeToolResult(part.output);
            yield {
              type: "status" as const,
              phase: "tool-result" as const,
              toolCallId: part.toolCallId,
              tool: part.toolName,
              resultCount: count,
              sources,
            };
            // Cumulative, ordered sources so inline [n] citations resolve as the
            // answer streams; the order matches the numbers the tools assigned.
            yield { type: "sources" as const, sources: getSources() };
          } else if (part.type === "tool-error") {
            console.error("chat.send tool error", part.toolName, part.error);
          } else if (part.type === "text-delta") {
            if (!generatingEmitted) {
              generatingEmitted = true;
              yield { type: "status" as const, phase: "generating" as const };
            }
            firstTokenAt ??= performance.now();
            yield { type: "delta" as const, text: part.text };
          }
        }

        // Resolve once the stream above has fully drained.
        const [streamedAnswer, usage, finishReason, warnings] =
          await Promise.all([
            result.text,
            result.usage,
            result.finishReason,
            result.warnings,
          ]);
        answer = streamedAnswer;

        // Final cumulative sources (covers a turn that answered with no tool calls).
        const sources = getSources();
        yield { type: "sources" as const, sources };

        const generationDurationMs = Math.round(
          performance.now() - generationStart,
        );
        const timeToFirstTokenMs =
          firstTokenAt === null
            ? null
            : Math.round(firstTokenAt - generationStart);

        // A structured record of how this turn was built: token spend, why the
        // model stopped, how many tools it called, and how many notes it cited.
        const trace = {
          model: CHAT_MODEL,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          finishReason,
          warnings,
          toolCallCount,
          sourceCount: sources.length,
          timeToFirstTokenMs,
          generationDurationMs,
          totalDurationMs: Math.round(performance.now() - startedAt),
        };
        yield { type: "trace" as const, trace };

        // Suggest a few next questions based on the full answer. Best-effort: a
        // failure here shouldn't sink a turn whose answer already streamed fine.
        try {
          yield { type: "status" as const, phase: "suggesting" as const };
          const { object } = await otelContext.with(turnContext, () =>
            generateObject({
              model: openai(CHAT_MODEL),
              schema: followupsSchema,
              system: FOLLOWUP_SYSTEM_PROMPT,
              messages: [
                ...input.messages,
                { role: "assistant", content: answer ?? "" },
              ],
              experimental_telemetry: {
                isEnabled: true,
                functionId: "suggest-followups",
              },
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
      } finally {
        // Close the trace with the assistant's answer as the turn output, then
        // flush after the response so nothing is lost when the function freezes.
        root.update({ output: answer });
        root.end();
        after(() => langfuseSpanProcessor.forceFlush());
      }
    }),

  /**
   * Condenses a full transcript into a compact recap. The chat is capped at a
   * fixed number of messages (see the `send` input schema); when a conversation
   * reaches it, the client calls this to fold the thread into a short summary and
   * seed a fresh conversation with it — continuing without losing the context or
   * hitting the hard limit head-on.
   */
  summarize: publicProcedure
    .input(z.object({ messages: z.array(messageSchema).min(1).max(50) }))
    .mutation(async ({ input }) => {
      const { text } = await generateText({
        model: openai(CHAT_MODEL),
        system: SUMMARY_SYSTEM_PROMPT,
        messages: input.messages,
        maxOutputTokens: 512,
        experimental_telemetry: {
          isEnabled: true,
          functionId: "summarize-conversation",
        },
      });

      return { summary: text.trim() };
    }),
});
