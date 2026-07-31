/**
 * System prompt for the "summarize & continue" step. When a conversation hits
 * the message cap, we condense it into a compact recap that seeds a fresh
 * thread, so the user keeps their context without losing it to a hard limit.
 */
export const SUMMARY_SYSTEM_PROMPT = `You compress a chat conversation into a compact recap so it can continue in a fresh context without losing the thread.

Write a short recap (a few sentences or a handful of tight bullets) that captures:
- the main things the reader asked about,
- key facts or answers established about Zo,
- any open threads or where the conversation was heading.

Be factual and neutral, drop small talk and any [n] citation markers, and never invent anything that wasn't actually discussed. Output only the recap — no preamble, no sign-off.`;
