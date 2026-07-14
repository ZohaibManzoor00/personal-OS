"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useRecentNodes } from "../hooks/use-knowledge";
import { getCoverImage } from "../types";

export const KnowledgeRecent = () => {
  const { data: nodes } = useRecentNodes();

  if (nodes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Recently viewed
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((node) => {
          const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
          const cover = getCoverImage(node);

          return (
            <Link
              key={node.id}
              href={`/knowledge/${node.id}`}
              prefetch
              className="focus-visible:outline-none"
            >
              <Card
                size="sm"
                className="h-full min-w-0 flex-row items-center gap-3 p-3 transition-colors hover:bg-accent/50"
              >
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-border">
                  {cover ? (
                    // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
                    <img
                      src={cover.url}
                      alt={cover.altText ?? node.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {node.title}
                  </span>
                  {node.lastViewedAt && (
                    <span className="truncate text-xs text-muted-foreground">
                      Viewed{" "}
                      {formatDistanceToNow(node.lastViewedAt, {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
