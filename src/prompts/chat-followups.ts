/**
 * System prompt for generating the clickable follow-up questions shown beneath
 * each chat answer. Runs as a best-effort step after the main answer streams.
 */
export const FOLLOWUP_SYSTEM_PROMPT = `You suggest follow-up questions the reader might click next to keep exploring Zo's work, given the conversation so far.

Rules:
- Phrase each as the reader asking about Zo's work (e.g. "How does Streamr handle backpressure?"), not as Zo speaking.
- Keep them short (under ~8 words) and immediately clickable.
- Make them distinct from each other and a genuine next step, not a rephrasing of what was just said.
- Prefer questions that go deeper into Zo's strongest, most relevant projects and expertise.`;
