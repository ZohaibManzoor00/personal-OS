"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { getCoverImage, type KnowledgeNode } from "../types";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";

export const KnowledgeCard = ({ node }: { node: KnowledgeNode }) => {
  const isSpace = node.type === "SPACE";
  const Icon = isSpace ? FolderIcon : FileTextIcon;
  const cover = getCoverImage(node);

  return (
    <Card
      size="sm"
      className="group/card relative h-full gap-0 p-0 py-0! transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <Link
        href={`/knowledge/${node.id}`}
        prefetch
        aria-label={node.title}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden border-b bg-muted">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
          <img
            src={cover.url}
            alt={cover.altText ?? node.title}
            className="size-full object-contain"
          />
        ) : (
          <Icon className="size-8 text-muted-foreground transition-colors group-hover/card:text-foreground" />
        )}
      </div>

      <KnowledgeNodeMenu
        node={node}
        className="absolute top-1.5 right-1.5 z-10 rounded-md bg-background/70 opacity-0 backdrop-blur-sm transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
      />

      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        <p className="truncate font-heading text-sm font-medium leading-snug">
          {node.title}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {isSpace ? "Space" : "Page"} &middot;{" "}
          {formatDistanceToNow(node.updatedAt, { addSuffix: true })}
        </p>
      </div>
    </Card>
  );
};
