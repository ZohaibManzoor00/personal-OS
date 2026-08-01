"use client";

import {
  ArrowUpIcon,
  Loader2Icon,
  PencilRulerIcon,
  SparklesIcon,
  SquareIcon,
  Wand2Icon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  SceneElementSummary,
  SceneMutation,
} from "@/features/draw/shared/operations";
import { KnowledgeMarkdown } from "@/features/knowledge/components/knowledge-markdown";
import { getStreamingTRPCClient } from "@/trpc/client";

// Matches the server-side transcript cap on draw.send.
const MAX_MESSAGES = 50;

type DrawStep =
  | { phase: "thinking" }
  | { phase: "editing"; label: string }
  | { phase: "generating" };

type DrawMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps?: DrawStep[];
  editCount?: number;
};

const SUGGESTIONS = [
  "Sketch a file upload system with presigned URLs and a CDN",
  "Critique this design — what's missing, risky, or won't scale?",
  "Walk me through what this diagram shows",
  "Add a cache and a load balancer to this design",
];

export const DrawChat = ({
  getScene,
  applyMutation,
  ready,
  onClose,
}: {
  getScene: () => SceneElementSummary[];
  applyMutation: (mutation: SceneMutation) => void;
  ready: boolean;
  onClose: () => void;
}) => {
  const [messages, setMessages] = useState<DrawMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStep, setCurrentStep] = useState<DrawStep | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const runTurn = async (history: DrawMessage[]) => {
    if (isStreaming || !ready) return;

    const assistantId = crypto.randomUUID();
    setMessages([
      ...history,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setIsStreaming(true);
    setCurrentStep(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const patchAssistant = (patch: (message: DrawMessage) => DrawMessage) =>
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId ? patch(message) : message,
        ),
      );

    try {
      const stream = await getStreamingTRPCClient().draw.send.mutate(
        {
          messages: history.map(({ role, content }) => ({ role, content })),
          scene: getScene(),
        },
        { signal: controller.signal },
      );

      for await (const event of stream) {
        if (event.type === "status") {
          const step: DrawStep =
            event.phase === "editing"
              ? { phase: "editing", label: event.label }
              : { phase: event.phase };
          setCurrentStep(step);
          patchAssistant((message) => ({
            ...message,
            steps: [...(message.steps ?? []), step],
          }));
        } else if (event.type === "mutation") {
          // Apply the edit to the live canvas the instant it streams in.
          applyMutation(event.mutation);
          patchAssistant((message) => ({
            ...message,
            editCount: (message.editCount ?? 0) + 1,
          }));
        } else if (event.type === "delta") {
          patchAssistant((message) => ({
            ...message,
            content: message.content + event.text,
          }));
        }
      }
    } catch (error) {
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

  const stop = () => abortRef.current?.abort();

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Wand2Icon className="size-4" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Draw assistant</span>
            <span className="text-[11px] text-muted-foreground">
              Ask it to edit the canvas
            </span>
          </div>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="size-8"
          aria-label="Close assistant"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="flex flex-col gap-5 px-4 py-5">
          {empty ? (
            <div className="flex flex-col items-center gap-6 pt-6 text-center">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <PencilRulerIcon className="size-5" />
              </span>
              <div className="space-y-1">
                <h2 className="font-heading text-base font-semibold">
                  Draw with words
                </h2>
                <p className="text-xs text-muted-foreground">
                  Describe a change and I'll edit the canvas — precisely.
                </p>
              </div>
              <div className="flex w-full flex-col gap-1.5">
                {SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => send(prompt)}
                    className="rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <DrawBubble key={message.id} message={message} />
            ))
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 pt-3 pb-4">
        {isStreaming && currentStep ? (
          <StreamingStatus step={currentStep} />
        ) : null}
        <div className="relative flex items-end gap-2 rounded-2xl border border-input bg-background p-2 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={ready ? "Describe a change…" : "Loading canvas…"}
            disabled={!ready}
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
              disabled={!input.trim() || !ready}
              onClick={() => send(input)}
              className="size-8 rounded-lg"
              aria-label="Send message"
            >
              <ArrowUpIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const DrawBubble = ({ message }: { message: DrawMessage }) => {
  const isUser = message.role === "user";
  const editCount = message.editCount ?? 0;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
        <SparklesIcon className="size-3.5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {editCount > 0 && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Wand2Icon className="size-3 text-primary" />
            Edited the canvas ({editCount})
          </span>
        )}
        {message.content === "" ? (
          editCount === 0 && <TypingDots />
        ) : (
          <KnowledgeMarkdown
            content={message.content}
            className="prose-sm min-w-0"
          />
        )}
      </div>
    </div>
  );
};

const stepLabel = (step: DrawStep): string => {
  switch (step.phase) {
    case "thinking":
      return "Thinking";
    case "editing":
      return step.label;
    case "generating":
      return "Writing";
  }
};

const StreamingStatus = ({ step }: { step: DrawStep }) => (
  <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
    <Loader2Icon className="size-3.5 shrink-0 animate-spin text-primary" />
    <span>{stepLabel(step)}</span>
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
