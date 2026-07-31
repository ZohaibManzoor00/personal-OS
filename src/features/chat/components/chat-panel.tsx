"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  BriefcaseIcon,
  CheckIcon,
  ChevronDownIcon,
  CompassIcon,
  GaugeIcon,
  GraduationCapIcon,
  Loader2Icon,
  type LucideIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
  TriangleAlertIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSectionIcon } from "@/features/dashboard/lib/section-meta";
import {
  type ChatDiagram,
  DiagramPreview,
} from "@/features/diagram/components/diagram-preview";
import type { CitationMap } from "@/features/knowledge/components/knowledge-markdown";
import { KnowledgeMarkdown } from "@/features/knowledge/components/knowledge-markdown";
import { buildNodeHref } from "@/features/knowledge/lib/search-navigation";
import { cn } from "@/lib/utils";
import { getStreamingTRPCClient } from "@/trpc/client";

// The transcript cap the chat.send / chat.summarize input schemas enforce on the
// server. We gate sends one turn early on the client so a normal message never
// trips that validation error — instead the user gets the limit card.
const MAX_MESSAGES = 50;

type ChatSource = {
  id: string;
  title: string;
  section: string;
};

// Model-provider warnings surfaced by the AI SDK (SharedV3Warning). The call
// still succeeds, but e.g. a setting may have been ignored.
type ChatWarning =
  | { type: "unsupported"; feature: string; details?: string }
  | { type: "compatibility"; feature: string; details?: string }
  | { type: "other"; message: string };

// Mirrors the `trace` returned by chat.send — the metrics describing how this
// turn was built (token spend, retrieval counts, timings).
type ChatTrace = {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  finishReason: string;
  warnings?: ChatWarning[];
  toolCallCount: number;
  sourceCount: number;
  timeToFirstTokenMs: number | null;
  generationDurationMs: number;
  totalDurationMs: number;
};

// A phase of a single turn, streamed from chat.send as it happens so the UI can
// show what the agent is actually doing (thinking, calling a tool and what it
// found, drafting, …) instead of an opaque spinner. Mirrors the `status` events
// the server yields, minus the `type` discriminator.
type ChatStep =
  | { phase: "thinking" }
  | { phase: "tool-call"; toolCallId: string; tool: string; label: string }
  | {
      phase: "tool-result";
      toolCallId: string;
      tool: string;
      resultCount: number;
      sources: ChatSource[];
    }
  | { phase: "generating" }
  | { phase: "suggesting" };

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  trace?: ChatTrace;
  followups?: string[];
  steps?: ChatStep[];
  diagrams?: ChatDiagram[];
};

// Starter prompts grouped by who's asking, so newcomers can pick the lane that
// fits them instead of guessing at a flat list of examples.
const SUGGESTION_GROUPS: Array<{
  persona: string;
  tagline: string;
  icon: LucideIcon;
  prompts: string[];
}> = [
  {
    persona: "Recruiter",
    tagline: "Sizing up Zo's work?",
    icon: BriefcaseIcon,
    prompts: [
      "What has Zo shipped recently?",
      "What are Zo's strengths as an engineer?",
    ],
  },
  {
    persona: "Student",
    tagline: "Here to learn?",
    icon: GraduationCapIcon,
    prompts: [
      "Quiz me on something from these notes",
      "Explain a concept Zo's been studying",
    ],
  },
  {
    persona: "Collaborator",
    tagline: "Working with Zo?",
    icon: UsersIcon,
    prompts: [
      "What projects are in flight right now?",
      "Draft a standup update from recent work",
    ],
  },
  {
    persona: "Just curious",
    tagline: "Poking around?",
    icon: CompassIcon,
    prompts: [
      "Summarize what Zo's been learning lately",
      "Surprise me with something interesting",
    ],
  },
];

export const ChatPanel = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  // Set while the "summarize & continue" recap is being generated.
  const [isSummarizing, setIsSummarizing] = useState(false);
  // The phase of the in-flight turn, surfaced live above the composer so the
  // user watches it move (Retrieving → Retrieved N chunks → Generating).
  const [currentStep, setCurrentStep] = useState<ChatStep | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Lets the user cut a streaming answer short. Held in a ref so the Stop button
  // can reach the in-flight request without re-rendering on every token.
  const abortRef = useRef<AbortController | null>(null);

  // Land in the composer ready to type the moment the page opens, for anyone who
  // lands here regardless of auth.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Follow the conversation as it grows (including each streamed token), but
  // don't yank the user back down if they've scrolled up to read earlier
  // messages.
  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [messages, isStreaming, atBottom, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distanceFromBottom < 80);
  };

  // Runs one assistant turn against a fixed history whose last entry is the user
  // message being answered. Shared by fresh sends, regenerate, and edit-resend —
  // each just hands over a different history and lets this own the streaming,
  // cancellation, and error handling.
  const runTurn = async (history: ChatMessage[]) => {
    if (isStreaming) return;

    // An empty assistant bubble we fill in as tokens stream. Tracking its id
    // lets us patch just this message on each event without touching the rest.
    const assistantId = crypto.randomUUID();
    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    // Starting a turn is an explicit intent to be at the latest message.
    setAtBottom(true);
    setIsStreaming(true);
    setCurrentStep(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const patchAssistant = (patch: (message: ChatMessage) => ChatMessage) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? patch(message) : message,
        ),
      );

    try {
      const stream = await getStreamingTRPCClient().chat.send.mutate(
        { messages: history.map(({ role, content }) => ({ role, content })) },
        { signal: controller.signal },
      );

      for await (const event of stream) {
        if (event.type === "status") {
          // Drive the live status line above the composer, and keep the running
          // list on the message so it can collapse into a summary afterwards.
          setCurrentStep(event);
          patchAssistant((message) => ({
            ...message,
            steps: [...(message.steps ?? []), event],
          }));
        } else if (event.type === "sources") {
          patchAssistant((message) => ({ ...message, sources: event.sources }));
        } else if (event.type === "diagram") {
          // Upsert the diagram by id as it transitions generating → done/empty.
          patchAssistant((message) => {
            const next: ChatDiagram = {
              id: event.id,
              status: event.status,
              mermaid: event.mermaid,
            };
            const existing = message.diagrams ?? [];
            const found = existing.some((diagram) => diagram.id === event.id);
            return {
              ...message,
              diagrams: found
                ? existing.map((diagram) =>
                    diagram.id === event.id ? next : diagram,
                  )
                : [...existing, next],
            };
          });
        } else if (event.type === "delta") {
          patchAssistant((message) => ({
            ...message,
            content: message.content + event.text,
          }));
        } else if (event.type === "trace") {
          patchAssistant((message) => ({ ...message, trace: event.trace }));
        } else if (event.type === "followups") {
          patchAssistant((message) => ({
            ...message,
            followups: event.followups,
          }));
        }
      }
    } catch (error) {
      // Drop the assistant bubble if nothing streamed in; keep any partial text
      // so the user still sees what arrived before the failure (or before they
      // hit Stop). A user-initiated abort isn't an error worth toasting.
      setMessages((current) =>
        current.filter(
          (message) => message.id !== assistantId || message.content.length > 0,
        ),
      );
      if (!controller.signal.aborted) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not reach the assistant. Please try again.",
        );
      }
    } finally {
      setIsStreaming(false);
      setCurrentStep(null);
      abortRef.current = null;
    }
  };

  const send = (raw: string) => {
    const content = raw.trim();
    if (!content || isStreaming || messages.length >= MAX_MESSAGES) return;
    setInput("");
    void runTurn([
      ...messages,
      { id: crypto.randomUUID(), role: "user", content },
    ]);
  };

  // At the transcript cap: fold the whole thread into a short recap and reseed a
  // fresh conversation with it, so the user keeps their context and can keep going
  // instead of hitting a dead end.
  const summarizeAndContinue = async () => {
    if (isStreaming || isSummarizing) return;
    setIsSummarizing(true);
    try {
      const { summary } = await getStreamingTRPCClient().chat.summarize.mutate({
        messages: messages.map(({ role, content }) => ({ role, content })),
      });
      const recap = summary.trim();
      setMessages(
        recap
          ? [
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: `_Here's where we left off:_\n\n${recap}`,
              },
            ]
          : [],
      );
      setInput("");
      setCurrentStep(null);
      setAtBottom(true);
      inputRef.current?.focus();
    } catch {
      toast.error("Couldn't summarize this one. You can start fresh instead.");
    } finally {
      setIsSummarizing(false);
    }
  };

  // Clear the board and begin a brand-new conversation.
  const startFresh = () => {
    if (isSummarizing) return;
    abortRef.current?.abort();
    setMessages([]);
    setInput("");
    setCurrentStep(null);
    setAtBottom(true);
    inputRef.current?.focus();
  };

  // Interrupt the in-flight answer; runTurn's abort branch keeps whatever text
  // already streamed in.
  const stop = () => abortRef.current?.abort();

  // Re-answer the most recent user message: drop the current assistant reply (and
  // its follow-ups) and stream a fresh one from the same history.
  const regenerate = () => {
    if (isStreaming) return;
    const lastUserIndex = messages.findLastIndex(
      (message) => message.role === "user",
    );
    if (lastUserIndex === -1) return;
    void runTurn(messages.slice(0, lastUserIndex + 1));
  };

  // Replace an earlier user message with edited text and re-answer from there,
  // discarding everything that followed it (that thread no longer applies).
  const editAndResend = (id: string, raw: string) => {
    const content = raw.trim();
    if (!content || isStreaming) return;
    const index = messages.findIndex((message) => message.id === id);
    if (index === -1) return;
    void runTurn([
      ...messages.slice(0, index),
      { ...messages[index], content },
    ]);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;
  // Once the transcript hits the cap, swap the composer for the limit card so the
  // next send can't fail server-side validation.
  const atLimit = messages.length >= MAX_MESSAGES;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Soft blur so messages dissolve into the top edge as they scroll away. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 backdrop-blur-sm mask-[linear-gradient(to_bottom,black,transparent)]" />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-2 py-6 sm:px-4">
          {empty ? (
            <div className="flex flex-col items-center gap-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                  <SparklesIcon className="size-6" />
                </span>
                <div className="space-y-1">
                  <h2 className="font-heading text-xl font-semibold">
                    Ask anything
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Not sure where to start? Pick who you are.
                  </p>
                </div>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-2">
                {SUGGESTION_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <div
                      key={group.persona}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {group.persona}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {group.tagline}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {group.prompts.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void send(prompt)}
                            className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatBubble
                key={message.id}
                message={message}
                // Only the latest turn offers follow-ups, so stale suggestions
                // from earlier answers don't linger mid-conversation.
                showFollowups={index === messages.length - 1 && !isStreaming}
                canSend={!isStreaming}
                onSelectFollowup={(followup) => send(followup)}
                // Regenerate hangs off the final assistant answer only.
                showRegenerate={
                  message.role === "assistant" &&
                  index === messages.length - 1 &&
                  !isStreaming
                }
                onRegenerate={regenerate}
                canEdit={!isStreaming}
                onEditSubmit={(content) => editAndResend(message.id, content)}
              />
            ))
          )}
        </div>
      </div>

      <div className="relative shrink-0 pt-3">
        {!empty && !atBottom && (
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => {
              setAtBottom(true);
              scrollToBottom();
            }}
            className="absolute -top-11 left-1/2 z-10 size-9 -translate-x-1/2 rounded-full bg-card shadow-md"
            aria-label="Scroll to latest"
          >
            <ArrowDownIcon className="size-4" />
          </Button>
        )}
        <div className="mx-auto w-full max-w-4xl px-2 sm:px-4">
          {atLimit ? (
            <ConversationLimitCard
              onSummarize={summarizeAndContinue}
              onStartFresh={startFresh}
              isSummarizing={isSummarizing}
            />
          ) : (
            <>
              {isStreaming && currentStep ? (
                <StreamingStatus step={currentStep} />
              ) : null}
              <div className="relative flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="Send a message…"
                  className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:border-0 focus-visible:ring-0"
                />
                {isStreaming ? (
                  <Button
                    type="button"
                    size="icon"
                    onClick={stop}
                    className="size-8 rounded-lg"
                    aria-label="Stop generating"
                  >
                    <SquareIcon className="size-3.5 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="icon"
                    disabled={!input.trim()}
                    onClick={() => send(input)}
                    className="size-8 rounded-lg"
                    aria-label="Send message"
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                The assistant can make mistakes. Enter to send, Shift+Enter for
                a new line.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Maps the assistant's distinct sources onto the citation numbers the model
// emits (`[1]`, `[2]`, …) so KnowledgeMarkdown can turn those markers into
// links. The order here mirrors the server's `sources` numbering.
const buildCitations = (sources: ChatSource[]): CitationMap =>
  Object.fromEntries(
    sources.map((source, index) => [
      index + 1,
      { href: buildNodeHref(source.section, source.id), title: source.title },
    ]),
  );

// The distinct citation numbers the answer actually references. We retrieve a
// wide net of chunks, but only the notes the model cites with a `[n]` marker
// belong in the Sources strip — listing every retrieved note surfaces off-topic
// results the answer never used. Numbers outside the known source range are
// ignored so a stray `[9]` can't sneak in.
const usedCitationNumbers = (
  content: string,
  sourceCount: number,
): Set<number> => {
  const used = new Set<number>();
  for (const match of content.matchAll(/\[(\d+)\]/g)) {
    const number = Number(match[1]);
    if (number >= 1 && number <= sourceCount) used.add(number);
  }
  return used;
};

// Diagrams render as interactive Excalidraw (from the concurrent diagram agent),
// so any Mermaid the prose model writes anyway is dropped before display —
// including an unterminated fence still streaming in. Notes rendering is
// untouched; this only applies to chat answers.
const stripMermaidBlocks = (content: string): string =>
  content
    .replace(/```mermaid[\s\S]*?```/gi, "")
    .replace(/```mermaid[\s\S]*$/i, "")
    .trimEnd();

const ChatBubble = ({
  message,
  showFollowups,
  canSend,
  onSelectFollowup,
  showRegenerate,
  onRegenerate,
  canEdit,
  onEditSubmit,
}: {
  message: ChatMessage;
  showFollowups: boolean;
  canSend: boolean;
  onSelectFollowup: (followup: string) => void;
  showRegenerate: boolean;
  onRegenerate: () => void;
  canEdit: boolean;
  onEditSubmit: (content: string) => void;
}) => {
  const isUser = message.role === "user";
  const followups = !isUser && showFollowups ? (message.followups ?? []) : [];
  const sources = message.sources ?? [];
  const steps = message.steps ?? [];
  const diagrams = isUser
    ? []
    : (message.diagrams ?? []).filter((diagram) => diagram.status !== "empty");
  // Diagrams are rendered as interactive Excalidraw from the diagram agent, so
  // any Mermaid the prose model emits is stripped — the reader only sees the
  // rendered diagram, never raw Mermaid source.
  const displayContent = isUser
    ? message.content
    : stripMermaidBlocks(message.content);
  const citations = sources.length > 0 ? buildCitations(sources) : undefined;
  // Only show the notes the answer actually cited, keeping each source's
  // original 1-based number so the strip's chips still line up with the inline
  // `[n]` markers even when earlier sources went uncited.
  const used =
    sources.length > 0
      ? usedCitationNumbers(message.content, sources.length)
      : undefined;
  const citedSources = used
    ? sources
        .map((source, index) => ({ source, number: index + 1 }))
        .filter(({ number }) => used.has(number))
    : [];

  // Local edit state for user messages: entering edit mode swaps the bubble for
  // a textarea seeded with the current text.
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const beginEdit = () => {
    setDraft(message.content);
    setIsEditing(true);
  };
  const submitEdit = () => {
    onEditSubmit(draft);
    setIsEditing(false);
  };

  if (isUser && isEditing) {
    return (
      <div className="flex flex-row-reverse gap-3">
        <div className="flex w-full max-w-[80%] flex-col gap-2">
          <Textarea
            value={draft}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitEdit();
              } else if (event.key === "Escape") {
                setIsEditing(false);
              }
            }}
            rows={2}
            className="resize-none rounded-2xl bg-card"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!draft.trim()}
              onClick={submitEdit}
            >
              Send
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("group/message flex gap-3", isUser && "flex-row-reverse")}
    >
      {!isUser && (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <SparklesIcon className="size-4" />
        </span>
      )}
      {/* Column so the follow-up bubbles can sit beneath the answer, aligned
          under it rather than beside the avatar. Assistant answers are markdown
          and use the full width; user messages stay a compact right-aligned
          bubble. */}
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          isUser ? "max-w-[80%] items-end" : "min-w-0 flex-1",
        )}
      >
        <div
          className={cn(
            "min-w-0 rounded-2xl text-sm",
            isUser
              ? "bg-primary px-4 py-2.5 text-primary-foreground"
              : "bg-card px-5 py-4 ring-1 ring-border",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <>
              {/* The phase timeline collapses into an expandable summary once the
                  answer starts, so the reader can see how the reply was built. */}
              {displayContent !== "" && steps.length > 0 && (
                <ThinkingTimeline steps={steps} />
              )}
              {displayContent === "" ? (
                // Waiting on the first streamed token. The live phase is shown
                // above the composer, so the bubble just needs the animation —
                // unless a diagram is already forming below.
                diagrams.length === 0 && <TypingDots />
              ) : (
                <KnowledgeMarkdown
                  content={displayContent}
                  className="prose-sm"
                  citations={citations}
                />
              )}
              {/* Diagrams stream in from the concurrent diagram agent, so they can
                  appear while the prose is still landing. */}
              {diagrams.length > 0 && (
                <div className="mt-3 flex flex-col gap-3">
                  {diagrams.map((diagram) => (
                    <DiagramPreview key={diagram.id} diagram={diagram} />
                  ))}
                </div>
              )}
              {displayContent !== "" && citedSources.length > 0 && (
                <ChatSources sources={citedSources} />
              )}
              {displayContent !== "" && message.trace && (
                <ChatTraceDetails trace={message.trace} />
              )}
            </>
          )}
        </div>

        {/* Per-message actions. Edit is revealed on hover for user messages;
            regenerate sits under the latest answer. */}
        {isUser && canEdit && (
          <button
            type="button"
            onClick={beginEdit}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/message:opacity-100"
          >
            <PencilIcon className="size-3" />
            Edit
          </button>
        )}
        {showRegenerate && (
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCwIcon className="size-3" />
            Regenerate
          </button>
        )}

        {followups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {followups.map((followup) => (
              <button
                key={followup}
                type="button"
                disabled={!canSend}
                onClick={() => onSelectFollowup(followup)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                {followup}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Compact, collapsible "how I got here" panel: the raw trace metrics from
// chat.send. This is the first surface for observability — persistence and a
// richer admin view come later.
const formatTokens = (value?: number) =>
  value === undefined ? "—" : value.toLocaleString();

const formatMs = (ms: number) =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms} ms`;

const formatWarning = (warning: ChatWarning) =>
  warning.type === "other"
    ? warning.message
    : `${warning.feature}${warning.details ? ` — ${warning.details}` : ""} (${warning.type})`;

const ChatTraceDetails = ({ trace }: { trace: ChatTrace }) => {
  const [open, setOpen] = useState(false);

  // Grouped so the numbers read as related sets (spend / retrieval / timing)
  // instead of one long list.
  const groups: Array<{ label: string; rows: Array<[string, string]> }> = [
    {
      label: "Tokens",
      rows: [
        ["Input", formatTokens(trace.inputTokens)],
        ["Output", formatTokens(trace.outputTokens)],
        ["Total", formatTokens(trace.totalTokens)],
      ],
    },
    {
      label: "Tools",
      rows: [
        ["Tool calls", `${trace.toolCallCount}`],
        ["Sources cited", `${trace.sourceCount}`],
      ],
    },
    {
      label: "Timing",
      // "Total" lives in the collapsed summary header, so it's omitted here.
      rows: [
        [
          "First token",
          trace.timeToFirstTokenMs === null
            ? "—"
            : formatMs(trace.timeToFirstTokenMs),
        ],
        ["Generation", formatMs(trace.generationDurationMs)],
      ],
    },
  ];

  const warningCount = trace.warnings?.length ?? 0;

  return (
    <div className="mt-3 border-t border-border/60 pt-2.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <GaugeIcon className="size-3 shrink-0" />
        Trace
        {/* At-a-glance summary so the key numbers are visible while collapsed. */}
        <span className="font-mono font-normal text-muted-foreground/70">
          {formatTokens(trace.totalTokens)} tokens ·{" "}
          {formatMs(trace.totalDurationMs)}
        </span>
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500">
            <TriangleAlertIcon className="size-3" />
            {warningCount}
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            "ml-auto size-3 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-2.5 space-y-2.5">
          {/* Model + finish reason as a header row above the metric groups. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {trace.model}
            </span>
            <span className="text-muted-foreground">
              finished:{" "}
              <span className="text-foreground">{trace.finishReason}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {groups.map((group) => (
              <dl key={group.label} className="space-y-1">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {group.label}
                </dt>
                {group.rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between gap-2 text-[11px] text-muted-foreground"
                  >
                    <span>{label}</span>
                    <span className="font-mono text-foreground">{value}</span>
                  </div>
                ))}
              </dl>
            ))}
          </div>

          {trace.warnings && trace.warnings.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-wide text-amber-600/80 dark:text-amber-500/80">
                Warnings
              </div>
              {trace.warnings.map((warning) => {
                const text = formatWarning(warning);
                return (
                  <div
                    key={`${warning.type}:${text}`}
                    className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-500"
                  >
                    <TriangleAlertIcon className="mt-0.5 size-3 shrink-0" />
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

// Human-readable label for a streamed phase. `retrieved` folds in the real
// counts so the timeline reports what actually happened, not a canned string.
const stepLabel = (step: ChatStep): string => {
  switch (step.phase) {
    case "thinking":
      return "Thinking";
    case "tool-call":
      return step.label;
    case "tool-result":
      return step.resultCount > 0
        ? `Found ${plural(step.resultCount, "result")}`
        : "Nothing found";
    case "generating":
      return "Drafting an answer";
    case "suggesting":
      return "Suggesting follow-ups";
  }
};

// Short label for the live status line above the composer. Phrased as the
// action in progress (Retrieving…, Generating…), with the real chunk count
// folded in once retrieval finishes.
const streamingLabel = (step: ChatStep): string => {
  switch (step.phase) {
    case "thinking":
      return "Thinking";
    case "tool-call":
      return step.label;
    case "tool-result":
      return step.resultCount > 0
        ? `Found ${plural(step.resultCount, "result")}`
        : "Nothing found";
    case "generating":
      return "Generating";
    case "suggesting":
      return "Suggesting follow-ups";
  }
};

// The evolving one-liner shown above the composer while a turn streams: a
// spinner, the current phase, and an animated ellipsis so it reads as live.
const StreamingStatus = ({ step }: { step: ChatStep }) => (
  <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
    <Loader2Icon className="size-3.5 shrink-0 animate-spin text-primary" />
    <span>{streamingLabel(step)}</span>
    <span className="inline-flex items-end gap-0.5 pb-0.5">
      {[0, 200, 400].map((delay) => (
        <span
          key={delay}
          className="size-1 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  </div>
);

// Once the answer starts, the phases collapse into an expandable summary so the
// "how I built this" trail stays available without crowding the reply.
const ThinkingTimeline = ({ steps }: { steps: ChatStep[] }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 border-b border-border/60 pb-2.5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <SparklesIcon className="size-3 shrink-0" />
        Worked through {plural(steps.length, "step")}
        <ChevronDownIcon
          className={cn(
            "ml-auto size-3 shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {steps.map((step) => (
            <li
              key={
                step.phase === "tool-call" || step.phase === "tool-result"
                  ? `${step.phase}-${step.toolCallId}`
                  : step.phase
              }
              className="flex flex-col gap-1 text-[11px] text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CheckIcon className="size-3 shrink-0 text-primary/70" />
                <span>{stepLabel(step)}</span>
              </div>
              {step.phase === "tool-result" && step.sources.length > 0 && (
                <div className="ml-5 flex flex-wrap gap-1">
                  {/* One note can surface via several chunks, so collapse to distinct notes. */}
                  {[
                    ...new Map(
                      step.sources.map((source) => [source.id, source]),
                    ).values(),
                  ].map((source) => {
                    const Icon = getSectionIcon(source.section);
                    return (
                      <span
                        key={source.id}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        <Icon className="size-2.5 shrink-0" />
                        <span className="truncate">{source.title}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ChatSources = ({
  sources,
}: {
  sources: Array<{ source: ChatSource; number: number }>;
}) => (
  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-2.5">
    <span className="w-full text-[11px] font-medium text-muted-foreground">
      Sources
    </span>
    {sources.map(({ source, number }) => {
      const Icon = getSectionIcon(source.section);
      return (
        <Link
          key={source.id}
          href={buildNodeHref(source.section, source.id)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pr-2.5 pl-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {/* The number ties each source back to its inline [n] citation. */}
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            {number}
          </span>
          <Icon className="size-3 shrink-0" />
          <span className="truncate">{source.title}</span>
        </Link>
      );
    })}
  </div>
);

// Shown in place of the composer once the conversation hits the message cap.
// Rather than dead-ending on a validation error, it offers to recap the thread
// and keep going, or wipe the slate — with a little of the assistant's dry voice.
const ConversationLimitCard = ({
  onSummarize,
  onStartFresh,
  isSummarizing,
}: {
  onSummarize: () => void;
  onStartFresh: () => void;
  isSummarizing: boolean;
}) => (
  <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center">
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">
        Well, we've talked this one to the limit.
      </p>
      <p className="text-xs text-muted-foreground">
        I can recap where we left off and keep going, or we start with a clean
        slate.
      </p>
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={onSummarize}
        disabled={isSummarizing}
        className="gap-1.5"
      >
        {isSummarizing ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <SparklesIcon className="size-4" />
        )}
        Summarize & continue
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onStartFresh}
        disabled={isSummarizing}
        className="gap-1.5"
      >
        <RefreshCwIcon className="size-4" />
        Start fresh
      </Button>
    </div>
  </div>
);

// The three bouncing dots shown inside an assistant bubble while we wait for
// the first streamed token. The bubble itself supplies the avatar and card.
const TypingDots = () => (
  <div className="flex items-center gap-1 py-1">
    {[0, 150, 300].map((delay) => (
      <span
        key={delay}
        className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
        style={{ animationDelay: `${delay}ms` }}
      />
    ))}
  </div>
);
