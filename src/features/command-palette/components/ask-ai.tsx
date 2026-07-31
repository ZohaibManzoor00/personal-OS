"use client";

import { ArrowLeftIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSectionIcon } from "@/features/dashboard/lib/section-meta";
import type { CitationMap } from "@/features/knowledge/components/knowledge-markdown";
import { KnowledgeMarkdown } from "@/features/knowledge/components/knowledge-markdown";
import { buildNodeHref } from "@/features/knowledge/lib/search-navigation";
import { getStreamingTRPCClient } from "@/trpc/client";

type Source = { id: string; title: string; section: string };

/** Citation number → link, mirroring the numbering the server emits. */
const buildCitations = (sources: Source[]): CitationMap =>
  Object.fromEntries(
    sources.map((source, index) => [
      index + 1,
      { href: buildNodeHref(source.section, source.id), title: source.title },
    ]),
  );

// Compact, human-readable label for each streamed phase. The palette is a tight
// surface, so we keep these short (no counts) — the full timeline lives in the
// dedicated chat view.
const PHASE_LABEL: Record<string, string> = {
  retrieving: "Searching your notes…",
  retrieved: "Reading your notes…",
  generating: "Drafting an answer…",
  suggesting: "Wrapping up…",
};

/** The distinct `[n]` markers the answer actually referenced. */
const usedCitationNumbers = (content: string, sourceCount: number) => {
  const used = new Set<number>();
  for (const match of content.matchAll(/\[(\d+)\]/g)) {
    const number = Number(match[1]);
    if (number >= 1 && number <= sourceCount) used.add(number);
  }
  return used;
};

/**
 * Streams a single RAG answer for `question` straight into the command palette,
 * reusing the same `chat.send` turn as the full AI chat (so Langfuse tracing
 * still applies). Follow-up suggestions are intentionally not rendered here.
 */
export const AskAiView = ({
  question,
  onBack,
}: {
  question: string;
  onBack: () => void;
}) => {
  const [content, setContent] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [phase, setPhase] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    setContent("");
    setSources([]);
    setPhase(null);
    setError(null);
    setIsStreaming(true);

    (async () => {
      try {
        const stream = await getStreamingTRPCClient().chat.send.mutate(
          { messages: [{ role: "user", content: question }] },
          { signal: controller.signal },
        );

        for await (const event of stream) {
          if (event.type === "status") {
            setPhase(event.phase);
          } else if (event.type === "sources") {
            setSources(event.sources);
          } else if (event.type === "delta") {
            setContent((current) => current + event.text);
          }
          // `trace` and `followups` are ignored — tracing is captured
          // server-side and suggestions aren't wanted in the palette.
        }
      } catch (streamError) {
        if (!controller.signal.aborted) {
          setError(
            streamError instanceof Error
              ? streamError.message
              : "Could not reach the assistant. Please try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setIsStreaming(false);
      }
    })();

    return () => controller.abort();
  }, [question]);

  // Keep the newest tokens in view as they stream in.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [content]);

  const citations = sources.length > 0 ? buildCitations(sources) : undefined;
  const used =
    sources.length > 0 ? usedCitationNumbers(content, sources.length) : undefined;
  const citedSources = used
    ? sources
        .map((source, index) => ({ source, number: index + 1 }))
        .filter(({ number }) => used.has(number))
    : [];

  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b p-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to search"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <SparklesIcon className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium text-foreground">
          {question}
        </p>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : content === "" ? (
          <div className="flex items-center gap-2">
            <TypingDots />
            {phase ? <span className="text-xs text-muted-foreground">{PHASE_LABEL[phase] ?? "Thinking…"}</span> : null}
          </div>
        ) : (
          <>
            <KnowledgeMarkdown
              content={content}
              className="prose-sm"
              citations={citations}
            />
            {!isStreaming && citedSources.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
                <span className="w-full text-[11px] font-medium text-muted-foreground">
                  Sources
                </span>
                {citedSources.map(({ source, number }) => {
                  const Icon = getSectionIcon(source.section);
                  return (
                    <Link
                      key={source.id}
                      href={buildNodeHref(source.section, source.id)}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background py-1 pr-2.5 pl-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {number}
                      </span>
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate">{source.title}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>{isStreaming ? ((phase ? PHASE_LABEL[phase] : null) ?? "Thinking…") : ""}</span>
        <span>esc close</span>
      </div>
    </div>
  );
};

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
