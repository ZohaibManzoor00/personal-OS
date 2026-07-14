"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { Node as KnowledgeNode } from "@/generated/prisma/client";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";

export const KnowledgeCard = ({ node }: { node: KnowledgeNode }) => {
  const isSpace = node.type === "SPACE";
  const Icon = isSpace ? FolderIcon : FileTextIcon;

  return (
    <Link
      href={`/knowledge/${node.id}`}
      prefetch
      className="group/link block focus-visible:outline-none"
    >
      <Card
        size="sm"
        className="h-full justify-between gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md group-focus-visible/link:ring-2 group-focus-visible/link:ring-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover/link:text-foreground">
            <Icon className="size-4.5" />
          </div>
          <KnowledgeNodeMenu
            node={node}
            className="-mt-1 -mr-1 opacity-0 transition-opacity group-hover/link:opacity-100 focus-visible:opacity-100"
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
    </Link>
  );
};
