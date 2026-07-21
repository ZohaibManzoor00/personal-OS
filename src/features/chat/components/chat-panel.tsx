"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import { getSectionIcon } from "@/features/dashboard/lib/section-meta";
import { KnowledgeMarkdown } from "@/features/knowledge/components/knowledge-markdown";
import { buildNodeHref } from "@/features/knowledge/lib/search-navigation";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type ChatSource = {
  id: string;
  title: string;
  section: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
};

const SUGGESTIONS = [
  "Summarize what I've been learning lately",
  "Draft a standup update from my recent work",
  "Quiz me on something from my notes",
];

export const ChatPanel = () => {
  const trpc = useTRPC();
  const { isOwner } = useIsOwner();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation(
    trpc.chat.send.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Follow the conversation as it grows, but don't yank the user back down if
  // they've scrolled up to read earlier messages.
  useEffect(() => {
    if (atBottom) scrollToBottom();
  }, [messages, sendMutation.isPending, atBottom, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distanceFromBottom < 80);
  };

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || sendMutation.isPending) return;

    const next: ChatMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content },
    ];
    setMessages(next);
    setInput("");
    // Sending is an explicit intent to be at the latest message.
    setAtBottom(true);

    try {
      const { text, sources } = await sendMutation.mutateAsync({
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: text, sources },
      ]);
    } catch {
      // Surfaced via the mutation's onError toast.
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
  };

  const empty = messages.length === 0;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {/* Soft blur so messages dissolve into the top edge as they scroll away. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 backdrop-blur-sm mask-[linear-gradient(to_bottom,black,transparent)]" />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-1 py-4">
          {empty ? (
            <div className="flex flex-col items-center gap-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <SparklesIcon className="size-6" />
              </span>
              <div className="space-y-1">
                <h2 className="font-heading text-xl font-semibold">
                  Ask Jarvis anything
                </h2>
                <p className="text-sm text-muted-foreground">
                  Your AI assistant for everything in your personal OS.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={!isOwner}
                    onClick={() => void send(suggestion)}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatBubble key={message.id} message={message} />
            ))
          )}

          {sendMutation.isPending && <TypingIndicator />}
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
        <div className="mx-auto w-full max-w-3xl">
          <div className="relative flex items-end gap-2 rounded-2xl border border-input bg-card p-2 shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              disabled={!isOwner}
              rows={1}
              placeholder={
                isOwner ? "Message Jarvis…" : "Chat is available to the owner"
              }
              className="max-h-40 min-h-0 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              size="icon"
              disabled={!isOwner || !input.trim() || sendMutation.isPending}
              onClick={() => void send(input)}
              className="size-8 rounded-lg"
              aria-label="Send message"
            >
              <ArrowUpIcon className="size-4" />
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Jarvis can make mistakes. Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      </div>
    </div>
  );
};

const ChatBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
          <SparklesIcon className="size-4" />
        </span>
      )}
      <div
        className={cn(
          "min-w-0 max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-card ring-1 ring-border",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            <KnowledgeMarkdown content={message.content} className="prose-sm" />
            {message.sources && message.sources.length > 0 && (
              <ChatSources sources={message.sources} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ChatSources = ({ sources }: { sources: ChatSource[] }) => (
  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/60 pt-2.5">
    <span className="w-full text-[11px] font-medium text-muted-foreground">
      Sources
    </span>
    {sources.map((source) => {
      const Icon = getSectionIcon(source.section);
      return (
        <Link
          key={source.id}
          href={buildNodeHref(source.section, source.id)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon className="size-3 shrink-0" />
          <span className="truncate">{source.title}</span>
        </Link>
      );
    })}
  </div>
);

const TypingIndicator = () => (
  <div className="flex gap-3">
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
      <SparklesIcon className="size-4" />
    </span>
    <div className="flex items-center gap-1 rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  </div>
);
