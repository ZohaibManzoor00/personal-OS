import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { embedNode } from "@/features/knowledge/server/embeddings";
import { langfuseSpanProcessor } from "@/instrumentation.node";
import { prisma } from "@/lib/db";
import { inngest } from "./client";

export const execute = inngest.createFunction({ id: "execute-ai", triggers: { event: "execute/ai" } }, async ({ step }) => {
  console.log("Executing AI...");
  const { steps } = await step.ai.wrap("openai generate text", generateText, {
    model: openai("gpt-4o"),
    prompt: "what is 2 * 2?",
  });
  console.log("AI response:", steps[0].text);
  return steps;
});

// How many nodes to (re)embed per run. Keeps each invocation bounded; anything
// left over is picked up on the next tick.
const BATCH_SIZE = 25;

/**
 * Keeps the vector index in sync with the notes.
 *
 * Runs on a schedule (and can be fired on demand via the "embeddings/sync"
 * event) to find notes whose content changed since they were last embedded and
 * re-embed them. Two rules keep it cheap and out of the way while you type:
 *
 * - Staleness is derived from the data itself (`embeddedAt` is null, or
 *   `updatedAt` is newer), so nothing has to be enqueued on save and the job is
 *   self-healing — anything missed is caught on the next run.
 * - A 2-minute "quiet window" (`updatedAt` must be at least 2 min old) means an
 *   active editing session is skipped until you stop, so rapid autosaves collapse
 *   into a single embed instead of one per keystroke burst.
 */
export const syncEmbeddings = inngest.createFunction(
  {
    id: "sync-embeddings",
    triggers: [{ cron: "*/5 * * * *" }, { event: "embeddings/sync" }],
  },
  async ({ step }) => {
    const staleIds = await step.run("find-stale-nodes", async () => {
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "Node"
        WHERE "archivedAt" IS NULL
          AND "body" IS NOT NULL AND "body" <> ''
          AND ("embeddedAt" IS NULL OR "updatedAt" > "embeddedAt")
          AND "updatedAt" < NOW() - INTERVAL '2 minutes'
        ORDER BY "updatedAt" ASC
        LIMIT ${BATCH_SIZE}
      `;
      return rows.map((row) => row.id);
    });

    const results: Array<{ id: string } & Awaited<ReturnType<typeof embedNode>>> = [];
    for (const id of staleIds) {
      const result = await step.run(`embed-${id}`, async () => {
        try {
          return await embedNode(id);
        } finally {
          // Each Inngest step can run in its own invocation; flush the trace
          // before this one returns so its spans aren't lost when it freezes.
          await langfuseSpanProcessor.forceFlush();
        }
      });
      results.push({ id, ...result });
    }

    return { scanned: staleIds.length, results };
  },
);

/**
 * Embeds a single node on demand, right now.
 *
 * Fired via the "embeddings/embed-node" event (with a `nodeId`) when a note is
 * saved and we want it searchable immediately, instead of waiting for the next
 * `syncEmbeddings` tick. It skips the staleness scan and the 2-minute quiet
 * window entirely and calls `embedNode` directly — which is already idempotent
 * (unchanged content short-circuits on the hash) and change-aware (a changed
 * note has all its chunks rebuilt), so firing it redundantly is cheap and safe.
 */
export const embedNodeNow = inngest.createFunction(
  { id: "embed-node-now", triggers: [{ event: "embeddings/embed-node" }] },
  async ({ event, step }) => {
    const nodeId = event.data.nodeId as string;

    return await step.run(`embed-${nodeId}`, async () => {
      try {
        return { id: nodeId, ...(await embedNode(nodeId)) };
      } finally {
        // Flush the trace before the step returns so its spans aren't lost when
        // the invocation freezes (each step can run in its own invocation).
        await langfuseSpanProcessor.forceFlush();
      }
    });
  },
);
