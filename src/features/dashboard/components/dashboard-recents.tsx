"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  useCarousel,
} from "@/components/ui/carousel";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  resolveSectionBasePath,
  resolveSectionLabel,
} from "@/features/knowledge/lib/sections";
import {
  type RecentSort,
  useDashboardRecentPagesPerSection,
} from "../hooks/use-dashboard";
import { getSectionIcon } from "../lib/section-meta";
import type { DashboardRecentPagesGroup } from "../types";

type RecentPageNode = DashboardRecentPagesGroup["nodes"][number];

/** Compact, image-free tile: file icon + title, with the relevant timestamp. */
const RecentPageCard = ({
  node,
  basePath,
  sort,
}: {
  node: RecentPageNode;
  basePath: string;
  sort: RecentSort;
}) => {
  const stamp = sort === "added" ? node.createdAt : node.updatedAt;
  const verb = sort === "added" ? "added" : "edited";

  return (
    <Link
      href={`${basePath}/${node.id}`}
      prefetch
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        size="sm"
        className="h-full w-44 gap-1.5 p-3 transition-colors hover:bg-accent/60"
      >
        <div className="flex items-center gap-2">
          <FileTextIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">{node.title}</span>
        </div>
        <span className="truncate text-xs text-muted-foreground">
          {verb} {formatDistanceToNow(stamp, { addSuffix: true })}
        </span>
      </Card>
    </Link>
  );
};

/**
 * Prev/next arrows for the surrounding carousel. Rendered as an overlay sibling
 * of the banner link (must live within `<Carousel>` to read its context) so the
 * controls always sit in a predictable spot and never nest inside the link.
 */
const CarouselNav = () => {
  const { scrollPrev, scrollNext, canScrollPrev, canScrollNext } =
    useCarousel();

  if (!canScrollPrev && !canScrollNext) return null;

  return (
    <div className="absolute right-3 bottom-3 z-10 flex items-center gap-1">
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        onClick={scrollPrev}
        disabled={!canScrollPrev}
        className="rounded-full bg-background/80 backdrop-blur-sm"
      >
        <ChevronLeftIcon />
        <span className="sr-only">Previous</span>
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="outline"
        onClick={scrollNext}
        disabled={!canScrollNext}
        className="rounded-full bg-background/80 backdrop-blur-sm"
      >
        <ChevronRightIcon />
        <span className="sr-only">Next</span>
      </Button>
    </div>
  );
};

/**
 * One section rendered like the dashboard section cards: its route cover as a
 * banner (the whole banner links into the section and scales on hover), then a
 * horizontal carousel of that section's most recent pages.
 */
const RecentSectionCard = ({
  group,
  sort,
}: {
  group: DashboardRecentPagesGroup;
  sort: RecentSort;
}) => {
  const Icon = getSectionIcon(group.section);
  const label = resolveSectionLabel(group.section);
  const basePath = resolveSectionBasePath(group.section);

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <Carousel opts={{ align: "start", dragFree: true }}>
        <div className="group/section relative h-24 overflow-hidden">
          <Link href={basePath} prefetch className="absolute inset-0 block">
            {group.coverUrl ? (
              // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
              <img
                src={group.coverUrl}
                alt=""
                className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/section:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-linear-to-br from-primary/30 via-muted to-accent transition-transform duration-300 group-hover/section:scale-105" />
            )}
            <div className="absolute inset-0 bg-background/25" />
            <div className="absolute inset-x-0 bottom-0 h-4 bg-linear-to-t from-card via-card/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 p-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-background/80 text-foreground ring-1 ring-border backdrop-blur-sm">
                <Icon className="size-4" />
              </span>
              <h3 className="font-heading text-base font-semibold">{label}</h3>
            </div>
          </Link>
          <CarouselNav />
        </div>

        <div className="p-3">
          <CarouselContent className="-ml-2">
            {group.nodes.map((node) => (
              <CarouselItem key={node.id} className="basis-auto pl-2">
                <RecentPageCard node={node} basePath={basePath} sort={sort} />
              </CarouselItem>
            ))}
          </CarouselContent>
        </div>
      </Carousel>
    </Card>
  );
};

/**
 * Per-section recent-page carousels — the dashboard's primary section overview.
 * A toggle switches the ranking between recently edited and recently added.
 */
export const DashboardRecents = () => {
  const [sort, setSort] = useState<RecentSort>("edited");
  const { data: groups } = useDashboardRecentPagesPerSection(sort);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Recents</h2>
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={sort}
          onValueChange={(value) => {
            if (value) setSort(value as RecentSort);
          }}
        >
          <ToggleGroupItem value="edited" className="text-xs">
            Edited
          </ToggleGroupItem>
          <ToggleGroupItem value="added" className="text-xs">
            Added
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {groups.map((group) => (
        <RecentSectionCard key={group.section} group={group} sort={sort} />
      ))}
    </div>
  );
};
