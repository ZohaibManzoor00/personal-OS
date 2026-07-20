"use client";

import Markdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const KnowledgeMarkdown = ({ content, className }: { content: string; className?: string }) => {
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
        "prose-a:font-medium prose-a:underline-offset-2",
        "prose-pre:rounded-xl prose-pre:bg-muted prose-pre:text-foreground prose-pre:ring-1 prose-pre:ring-border",
        "prose-code:before:content-none prose-code:after:content-none",
        "prose-img:mx-auto prose-img:my-6 prose-img:max-h-120 prose-img:w-auto prose-img:rounded-2xl prose-img:ring-1 prose-img:ring-border prose-img:shadow-md",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSlug]}
        components={{
          a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />,
          // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
          img: ({ node, ...props }) => <img loading="lazy" alt="" {...props} />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
