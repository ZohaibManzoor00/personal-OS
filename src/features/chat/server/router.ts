import { openai } from "@ai-sdk/openai";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import z from "zod";
import { createTRPCRouter, ownerProcedure } from "@/trpc/init";

const CHAT_MODEL = "gpt-4.1-nano";
const CHAT_MAX_CHARS = 8_000;

const CHAT_SYSTEM_PROMPT = `You are Jarvis, the assistant inside Zo's personal operating system — a knowledge hub of notes across Learnings, Career, Projects, and AI Workflows.

Be concise, direct, and genuinely helpful. Use GitHub-flavored Markdown for structure (headings, lists, code blocks) when it aids clarity. When you are unsure, say so rather than inventing facts.`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(CHAT_MAX_CHARS),
});

export const chatRouter = createTRPCRouter({
  /**
   * A single non-streaming turn: takes the running transcript and returns the
   * assistant's next reply. Owner-only so the app's OpenAI key is never exposed
   * to read-only visitors. Kept deliberately simple (no retrieval yet) — the
   * embeddings/NodeChunk layer can later be wired in here for RAG.
   */
  send: ownerProcedure
    .input(z.object({ messages: z.array(messageSchema).min(1).max(50) }))
    .mutation(async ({ input }) => {
      try {
        const { text } = await generateText({
          model: openai(CHAT_MODEL),
          system: CHAT_SYSTEM_PROMPT,
          messages: input.messages,
          temperature: 0.4,
          maxOutputTokens: 2048,
        });

        return { text };
      } catch (error) {
        console.error("chat.send failed", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not reach the assistant. Please try again.",
        });
      }
    }),
});
