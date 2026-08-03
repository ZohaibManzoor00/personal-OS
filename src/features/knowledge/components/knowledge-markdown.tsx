"use client";

import { useState } from "react";
import type { Options } from "react-markdown";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmbeddedDiagram } from "@/features/diagram/components/embedded-diagram";
import { CITATION_HREF_PREFIX, remarkCitations } from "@/features/knowledge/lib/remark-citations";
import { cn } from "@/lib/utils";

// A minimal structural view of the hast `<pre>` node react-markdown hands the
// `pre` component — enough to spot a fenced code block and pull its language +
// text, without importing hast's types (kept dependency-light).
type HastElement = {
  type?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: Array<{ type?: string; value?: string } & Partial<HastElement>>;
};

/**
 * A fenced ```excalidraw block carries a single diagram id on its own line. We
 * intercept it at the `pre` level (reading the hast node) so the interactive
 * canvas replaces the whole code block instead of being nested inside an invalid
 * `<pre><code>`. Returns the trimmed id, or null for any other code block.
 */
const excalidrawDiagramId = (node: HastElement | undefined): string | null => {
  const code = node?.children?.[0];
  if (code?.type !== "element" || code.tagName !== "code") return null;
  const className = code.properties?.className;
  const isExcalidraw =
    Array.isArray(className) && className.includes("language-excalidraw");
  if (!isExcalidraw) return null;
  const text = code.children?.[0];
  const id = text?.type === "text" ? (text.value ?? "").trim() : "";
  return id || null;
};

/**
 * An inline image that opens a full-screen lightbox on click so readers can view
 * it large without browser zoom. Keyboard accessible via the native button.
 */
const LightboxImage = (props: React.ComponentProps<"img">) => {
  const [open, setOpen] = useState(false);
  const { className, alt, ...rest } = props;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto block cursor-zoom-in border-0 bg-transparent p-0"
        aria-label={alt ? `Enlarge image: ${alt}` : "Enlarge image"}
      >
        {/* biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config */}
        <img loading="lazy" alt={alt ?? ""} className={className} {...rest} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="flex max-h-[95svh] max-w-[95vw] items-center justify-center border-0 bg-transparent p-0 ring-0 sm:max-w-[95vw]"
        >
          <DialogTitle className="sr-only">{alt || "Enlarged image"}</DialogTitle>
          {/* biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config */}
          <img
            alt={alt ?? ""}
            {...rest}
            className="max-h-[95svh] w-auto max-w-full rounded-lg object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

/**
 * Inline citation targets, keyed by the 1-based number the model cites (`[1]`,
 * `[2]`, …). When provided, `[n]` markers in the content become clickable source
 * chips. Notes rendering (no citations) simply omits this and any `[n]` stays
 * literal text.
 */
export type CitationMap = Record<number, { href: string; title: string }>;

export const KnowledgeMarkdown = ({
  content,
  className,
  citations,
}: {
  content: string;
  className?: string;
  citations?: CitationMap;
}) => {
  const citationNumbers = citations ? Object.keys(citations).map(Number) : [];
  const remarkPlugins: NonNullable<Options["remarkPlugins"]> = [remarkGfm, remarkBreaks];
  if (citationNumbers.length > 0) remarkPlugins.push([remarkCitations, new Set(citationNumbers)]);

  return (
    <div
      data-knowledge-body
      className={cn(
        "prose prose-neutral max-w-none leading-relaxed dark:prose-invert",
        // Comfortable reading rhythm: room between paragraphs, and headings sit
        // close to the text they introduce. The first element never adds a top
        // margin so it hugs the page title above it.
        "prose-p:my-4 prose-li:my-1 *:first:mt-0",
        // Offset anchor jumps so headings clear the fixed sticky header (h-14).
        "prose-headings:scroll-mt-24 prose-headings:font-heading prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h2:mt-8 prose-h2:mb-2 prose-h3:mt-6 prose-h3:mb-1.5",
        // Hairline rule under each H2 marks the start of a section, doc-site style.
        "prose-h2:border-b prose-h2:border-border prose-h2:pb-2",
        "prose-a:font-medium prose-a:underline-offset-2",
        // Blockquotes read as accent callouts rather than italic pull-quotes.
        "prose-blockquote:rounded-r-lg prose-blockquote:border-l-2 prose-blockquote:border-primary prose-blockquote:bg-muted/50 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-foreground",
        "[&_blockquote_p]:before:content-none [&_blockquote_p]:after:content-none",
        // Accent list markers.
        "[&_ul>li]:marker:text-primary/60",
        "prose-pre:rounded-xl prose-pre:bg-muted prose-pre:text-foreground prose-pre:ring-1 prose-pre:ring-border",
        "prose-code:before:content-none prose-code:after:content-none",
        // Inline code (not fenced blocks) gets a subtle pill treatment.
        "[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:bg-muted [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-normal",
        "prose-img:mx-auto prose-img:my-6 prose-img:max-h-120 prose-img:w-auto prose-img:rounded-2xl prose-img:ring-1 prose-img:ring-border prose-img:shadow-md",
        className,
      )}
    >
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[
          rehypeSlug,
          // Syntax-highlight fenced code blocks (```ts, ```tsx, ```python, …).
          // highlight.js has no dedicated tsx/jsx grammars, so alias them onto
          // the TypeScript/JavaScript ones (both handle JSX). `ignoreMissing`
          // keeps unknown/unlabeled languages as plain (uncolored) code.
          [
            rehypeHighlight,
            {
              ignoreMissing: true,
              aliases: { typescript: ["tsx"], javascript: ["jsx"] },
            },
          ],
        ]}
        components={{
          a: ({ node, href, children, ...props }) => {
            // A citation chip: swap the sentinel hash for the real note href and
            // render a compact superscript number instead of link text.
            if (citations && href?.startsWith(CITATION_HREF_PREFIX)) {
              const number = Number(href.slice(CITATION_HREF_PREFIX.length));
              const target = citations[number];
              if (!target) return <>[{number}]</>;
              return (
                <a
                  href={target.href}
                  title={target.title}
                  className="ml-0.5 inline-flex items-center rounded bg-primary/10 px-1 align-super text-[0.65em] font-semibold text-primary no-underline transition-colors hover:bg-primary/20"
                >
                  {number}
                </a>
              );
            }
            return <a target="_blank" rel="noopener noreferrer" href={href} {...props}>{children}</a>;
          },
          img: ({ node, ...props }) => <LightboxImage {...props} />,
          pre: ({ node, children, ...props }) => {
            const diagramId = excalidrawDiagramId(node);
            if (diagramId) return <EmbeddedDiagram diagramId={diagramId} />;
            return <pre {...props}>{children}</pre>;
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
