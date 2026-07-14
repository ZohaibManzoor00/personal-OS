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
      className="group/card relative h-full justify-between gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <Link
        href={`/knowledge/${node.id}`}
        prefetch
        aria-label={node.title}
        className="absolute inset-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex items-start justify-between gap-2">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
          <img
            src={cover.url}
            alt={cover.altText ?? node.title}
            className="size-9 rounded-lg object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover/card:text-foreground">
            <Icon className="size-4.5" />
          </div>
        )}
        <KnowledgeNodeMenu
          node={node}
          className="relative z-10 -mt-1 -mr-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-visible:opacity-100"
        />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-medium leading-snug">
          {node.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {isSpace ? "Space" : "Page"} &middot; Updated{" "}
          {formatDistanceToNow(node.updatedAt, { addSuffix: true })}
        </p>
      </div>
    </Card>
  );
};
