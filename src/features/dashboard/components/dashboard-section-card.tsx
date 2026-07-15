"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronRightIcon, FileTextIcon, FolderIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  resolveSectionBasePath,
  resolveSectionLabel,
} from "@/features/knowledge/lib/sections";
import { getCoverImage } from "@/features/knowledge/types";
import { getSectionIcon } from "../lib/section-meta";
import type { DashboardSectionGroup } from "../types";

/**
 * A single section (Learnings, Career, …) rendered as a card: its route cover as
 * a banner, then a short list of its most recent items.
 */
export const DashboardSectionCard = ({
  group,
}: {
  group: DashboardSectionGroup;
}) => {
  const Icon = getSectionIcon(group.section);
  const basePath = resolveSectionBasePath(group.section);
  const label = resolveSectionLabel(group.section);

  return (
    <Card className="group/section gap-0 overflow-hidden p-0">
      <Link
        href={basePath}
        prefetch
        className="relative block h-28 overflow-hidden"
      >
        {group.coverUrl ? (
          // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
          <img
            src={group.coverUrl}
            alt=""
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/section:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-primary/30 via-muted to-accent" />
        )}
        {/* Fade the image into the card so the label sits on a legible base. */}
        <div className="absolute inset-0 bg-linear-to-t from-card via-card/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background/80 text-foreground ring-1 ring-border backdrop-blur-sm">
              <Icon className="size-4" />
            </span>
            <h2 className="font-heading text-base font-semibold">{label}</h2>
          </div>
          <span className="flex items-center gap-0.5 rounded-full bg-background/80 px-2 py-1 text-xs text-muted-foreground ring-1 ring-border backdrop-blur-sm transition-colors group-hover/section:text-foreground">
            View all
            <ChevronRightIcon className="size-3.5" />
          </span>
        </div>
      </Link>

      <div className="flex flex-col p-2">
        {group.nodes.map((node) => {
          const NodeIcon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
          const cover = getCoverImage(node);
          const usedAt = node.lastViewedAt ?? node.updatedAt;

          return (
            <Link
              key={node.id}
              href={`${basePath}/${node.id}`}
              prefetch
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
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
                  <NodeIcon className="size-4" />
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {node.title}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {formatDistanceToNow(usedAt, { addSuffix: true })}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};
