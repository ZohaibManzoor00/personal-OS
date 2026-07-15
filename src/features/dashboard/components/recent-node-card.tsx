"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  resolveSectionBasePath,
  resolveSectionLabel,
} from "@/features/knowledge/lib/sections";
import { getCoverImage } from "@/features/knowledge/types";
import { getSectionIcon } from "../lib/section-meta";
import type { DashboardRecentNode } from "../types";

/**
 * Compact card for a single recent node. `showSection` adds a section pill —
 * used in the cross-section row where the origin isn't otherwise obvious.
 */
export const RecentNodeCard = ({
  node,
  showSection = false,
}: {
  node: DashboardRecentNode;
  showSection?: boolean;
}) => {
  const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
  const SectionIcon = getSectionIcon(node.section);
  const cover = getCoverImage(node);
  const usedAt = node.lastViewedAt ?? node.updatedAt;

  return (
    <Link
      href={`${resolveSectionBasePath(node.section)}/${node.id}`}
      prefetch
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        size="sm"
        className="h-full min-w-0 flex-row items-center gap-3 p-3 transition-colors hover:bg-accent/50"
      >
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground ring-1 ring-border">
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
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium">{node.title}</span>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            {showSection ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                <SectionIcon className="size-3" />
                {resolveSectionLabel(node.section)}
              </span>
            ) : null}
            <span className="truncate">
              {formatDistanceToNow(usedAt, { addSuffix: true })}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
};
