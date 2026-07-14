"use client";

import Markdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

export const KnowledgeMarkdown = ({ content, className }: { content: string; className?: string }) => {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert prose-headings:font-heading prose-headings:tracking-tight prose-pre:rounded-lg prose-pre:bg-muted prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none prose-img:mx-auto prose-img:max-h-104 prose-img:w-auto prose-img:rounded-xl prose-img:border prose-img:shadow-xs",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
          // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
          img: ({ node, ...props }) => <img loading="lazy" alt="" {...props} />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
