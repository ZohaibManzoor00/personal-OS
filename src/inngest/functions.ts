import { generateText } from "ai";
import { inngest } from "./client";
import { openai } from "@ai-sdk/openai";

export const execute = inngest.createFunction({ id: "execute-ai", triggers: { event: "execute/ai" } }, async ({ event, step }) => {
  console.log("Executing AI...");
  const { steps } = await step.ai.wrap("openai generate text", generateText, {
    model: openai("gpt-4o"),
    prompt: "what is 2 * 2?",
  });
  console.log("AI response:", steps[0].text);
  return steps;
});
