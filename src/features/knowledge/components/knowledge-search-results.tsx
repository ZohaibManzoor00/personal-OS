"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useKnowledgeSearch } from "../hooks/use-knowledge";
import { groupSearchResultsBySection } from "../lib/group-results";
import { resolveSectionBasePath } from "../lib/sections";
import { getCoverImage, type KnowledgeSearchResult } from "../types";
import { Highlighted, ResultBreadcrumbTitle } from "./knowledge-highlight";
import { useKnowledgeSection } from "./knowledge-section-context";

const SearchResultCard = ({
  node,
  onKeyDown,
}: {
  node: KnowledgeSearchResult;
  onKeyDown: React.KeyboardEventHandler<HTMLAnchorElement>;
}) => {
  const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
  const cover = getCoverImage(node);
  const usedAt = node.lastViewedAt ?? node.updatedAt;

  return (
    <Link
      href={`${resolveSectionBasePath(node.section)}/${node.id}`}
      prefetch
      data-search-result
      onKeyDown={onKeyDown}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card
        size="sm"
        className={cn("flex-row gap-3 p-3 transition-colors hover:bg-accent/50", node.snippet ? "items-start" : "items-center")}
      >
        <div className="shrink-0">
          {cover ? (
            // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
            <img src={cover.url} alt={cover.altText ?? node.title} className="size-9 rounded-md object-cover ring-1 ring-border" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-4" />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-2">
            <ResultBreadcrumbTitle breadcrumb={node.breadcrumb} titleHighlight={node.titleHighlight} className="min-w-0 flex-1" />
            <span className="shrink-0 text-[11px] text-muted-foreground">{formatDistanceToNow(usedAt, { addSuffix: true })}</span>
          </div>

          {node.snippet ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              <Highlighted value={node.snippet} />
            </p>
          ) : null}

          <span className="text-[11px] text-muted-foreground/70">{node.type === "SPACE" ? "Space" : "Page"}</span>
        </div>
      </Card>
    </Link>
  );
};

export const KnowledgeSearchResults = ({ query }: { query: string }) => {
  const section = useKnowledgeSection();
  const { data, isLoading } = useKnowledgeSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep Tab / Shift+Tab moving strictly between result items. Tabbing past the
  // last item (or Shift+Tab before the first) falls back to the normal focus
  // order, with the first item returning focus to the search input.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== "Tab") return;

    const items = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-search-result]") ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;

    if (event.shiftKey) {
      event.preventDefault();
      if (index === 0) {
        document.querySelector<HTMLElement>("[data-knowledge-search-input]")?.focus();
      } else {
        items[index - 1]?.focus();
      }
      return;
    }

    if (index < items.length - 1) {
      event.preventDefault();
      items[index + 1]?.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <div className="py-16 text-center text-sm text-muted-foreground">No results for "{query}"</div>;
  }

  const groups = groupSearchResultsBySection(data, section.section);
  const showHeadings = groups.length > 1;

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.section} className="flex flex-col gap-2">
          {showHeadings && (
            <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
              {group.section === section.section && <span className="ml-1.5 normal-case text-muted-foreground/60">· current</span>}
            </h3>
          )}
          {group.results.map((node) => (
            <SearchResultCard key={node.id} node={node} onKeyDown={handleKeyDown} />
          ))}
        </div>
      ))}
    </div>
  );
};
