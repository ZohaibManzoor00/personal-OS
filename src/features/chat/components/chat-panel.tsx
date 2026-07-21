"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowUpIcon, SparklesIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import { KnowledgeMarkdown } from "@/features/knowledge/components/knowledge-markdown";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMutation = useMutation(
    trpc.chat.send.mutationOptions({
      onError: (error) => toast.error(error.message),
    }),
  );

  // Keep the newest message (and the typing indicator) in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sendMutation.isPending]);

  const send = async (raw: string) => {
    const content = raw.trim();
    if (!content || sendMutation.isPending) return;

    const next: ChatMessage[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content },
    ];
    setMessages(next);
    setInput("");

    try {
      const { text } = await sendMutation.mutateAsync({
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: text },
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
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
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

      <div className="shrink-0 pt-3">
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
          <KnowledgeMarkdown content={message.content} className="prose-sm" />
        )}
      </div>
    </div>
  );
};

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
