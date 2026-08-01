import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { stepCountIs, streamText, tool } from "ai";
import z from "zod";
import {
  addShapesInput,
  clearCanvasInput,
  deleteShapesInput,
  sceneElementSummarySchema,
  toMutation,
  updateShapesInput,
} from "@/features/draw/shared/operations";
import { buildDrawSystemPrompt } from "@/prompts/draw-system";
import { createTRPCRouter, publicProcedure } from "@/trpc/init";

const DRAW_MODEL = "gpt-5.4-mini";
const DRAW_MAX_CHARS = 8_000;

// Upper bound on the tool→answer loop for one turn. The agent may take several
// scene edits (add a cluster, then reposition, then recolor) before it answers,
// so this is a touch higher than the chat agent's budget.
const MAX_STEPS = 8;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(DRAW_MAX_CHARS),
});

/** A one-line "what it's doing" label for the streaming status line. */
const toolLabel = (toolName: string): string => {
  switch (toolName) {
    case "addShapes":
      return "Adding shapes";
    case "updateShapes":
      return "Updating shapes";
    case "deleteShapes":
      return "Removing shapes";
    case "clearCanvas":
      return "Clearing the canvas";
    default:
      return "Editing the canvas";
  }
};

export const drawRouter = createTRPCRouter({
  /**
   * A single streaming turn for the Draw whiteboard's assistant. Public, like
   * chat — anyone can talk to it. The client sends the conversation plus a
   * compact snapshot of the current canvas; the agent answers and, when asked,
   * edits the drawing by calling scene-edit tools.
   *
   * The tools deliberately do almost nothing server-side: the canvas lives only
   * in the browser, so we relay each tool call's input to the client as a
   * `mutation` event and let it apply the change precisely. Yields a
   * discriminated stream:
   *   - `status`   — `thinking` / `editing` / `generating` phase updates.
   *   - `mutation` — a scene edit (add / update / delete / clear) to apply.
   *   - `delta`    — successive chunks of the assistant's prose reply.
   *   - `trace`    — final metrics once the turn ends.
   */
  send: publicProcedure
    .input(
      z.object({
        messages: z.array(messageSchema).min(1).max(50),
        scene: z.array(sceneElementSummarySchema).max(500),
      }),
    )
    .mutation(async function* ({ input }) {
      const startedAt = performance.now();

      // The scene-edit tools carry their work in their *inputs*, which we relay
      // to the client — the execute step just acknowledges so the model can
      // continue and write its reply.
      const tools = {
        addShapes: tool({
          description:
            "Add one or more new shapes to the canvas. Give each shape a stable, unique id. To connect new nodes with arrows, include the nodes and the arrows in the same call so the arrows bind.",
          inputSchema: addShapesInput,
          execute: async ({ shapes }) => ({ added: shapes.length }),
        }),
        updateShapes: tool({
          description:
            "Modify existing shapes in place, targeted by id: move, resize, recolor, or change their text. Never re-create a shape to change it.",
          inputSchema: updateShapesInput,
          execute: async ({ updates }) => ({ updated: updates.length }),
        }),
        deleteShapes: tool({
          description: "Delete existing shapes from the canvas, by id.",
          inputSchema: deleteShapesInput,
          execute: async ({ ids }) => ({ deleted: ids.length }),
        }),
        clearCanvas: tool({
          description:
            "Remove everything from the canvas. Only call this when the user explicitly asks to clear or start over.",
          inputSchema: clearCanvasInput,
          execute: async () => ({ cleared: true }),
        }),
      };

      try {
        yield { type: "status" as const, phase: "thinking" as const };

        const generationStart = performance.now();
        const result = streamText({
          model: openai(DRAW_MODEL),
          system: buildDrawSystemPrompt(input.scene),
          messages: input.messages,
          tools,
          stopWhen: stepCountIs(MAX_STEPS),
          maxOutputTokens: 2048,
          timeout: { totalMs: 45_000 },
          experimental_telemetry: {
            isEnabled: true,
            functionId: "draw-agent",
          },
        });

        let firstTokenAt: number | null = null;
        let generatingEmitted = false;
        let editCount = 0;

        for await (const part of result.fullStream) {
          if (part.type === "tool-call") {
            const mutation = toMutation(part.toolName, part.input);
            if (mutation) {
              editCount += 1;
              yield {
                type: "status" as const,
                phase: "editing" as const,
                label: toolLabel(part.toolName),
              };
              yield { type: "mutation" as const, mutation };
            }
          } else if (part.type === "tool-error") {
            console.error("draw.send tool error", part.toolName, part.error);
          } else if (part.type === "text-delta") {
            if (!generatingEmitted) {
              generatingEmitted = true;
              yield { type: "status" as const, phase: "generating" as const };
            }
            firstTokenAt ??= performance.now();
            yield { type: "delta" as const, text: part.text };
          }
        }

        const [usage, finishReason] = await Promise.all([
          result.usage,
          result.finishReason,
        ]);

        const generationDurationMs = Math.round(
          performance.now() - generationStart,
        );
        const timeToFirstTokenMs =
          firstTokenAt === null
            ? null
            : Math.round(firstTokenAt - generationStart);

        yield {
          type: "trace" as const,
          trace: {
            model: DRAW_MODEL,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
            finishReason,
            editCount,
            timeToFirstTokenMs,
            generationDurationMs,
            totalDurationMs: Math.round(performance.now() - startedAt),
          },
        };
      } catch (error) {
        console.error("draw.send failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not reach the assistant. Please try again.",
        });
      }
    }),
});
