"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon, LockIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getCoverImage, type KnowledgeNode } from "../types";
import { KnowledgeMarkdown } from "./knowledge-markdown";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";
import { useKnowledgeSection } from "./knowledge-section-context";

const PREVIEW_CHAR_LIMIT = 500;

export const KnowledgeCard = ({ node }: { node: KnowledgeNode }) => {
  const section = useKnowledgeSection();
  const isSpace = node.type === "SPACE";
  const Icon = isSpace ? FolderIcon : FileTextIcon;
  const cover = getCoverImage(node);

  const preview = isSpace ? "" : (node.body ?? "").trim();
  const hasPreview = !cover && preview.length > 0;

  return (
    <Card
      size="sm"
      className="group/card relative h-full gap-0 p-0 py-0! transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <Link
        href={`${section.basePath}/${node.id}`}
        prefetch
        aria-label={node.title}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="pointer-events-none relative flex aspect-video w-full items-center justify-center overflow-hidden border-b bg-muted">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
          <img src={cover.url} alt={cover.altText ?? node.title} className="size-full object-contain" />
        ) : hasPreview ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-card">
            <div className="w-[200%] origin-top-left scale-50 p-4">
              <KnowledgeMarkdown content={preview.slice(0, PREVIEW_CHAR_LIMIT)} />
            </div>
            <div className="absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-card to-transparent" />
          </div>
        ) : (
          <Icon className="size-8 text-muted-foreground transition-colors group-hover/card:text-foreground" />
        )}
      </div>

      {node.locked && (
        <span
          className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur-sm"
          title="Personal — only visible to you"
        >
          <LockIcon className="size-3" />
          Personal
        </span>
      )}

      <KnowledgeNodeMenu
        node={node}
        className="absolute top-1.5 right-1.5 z-10 rounded-md bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
      />

      <div className="flex flex-col gap-0.5 px-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-heading text-sm font-medium leading-snug">{node.title}</p>
          <Icon className={cn("size-3.5 shrink-0", isSpace ? "text-muted-foreground" : "text-blue-500")} />
        </div>
        <p className="truncate text-xs text-muted-foreground">{formatDistanceToNow(node.updatedAt, { addSuffix: true })}</p>
      </div>
    </Card>
  );
};
