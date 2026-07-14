"use client";

import { formatDistanceToNow } from "date-fns";
import { FileTextIcon, FolderIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useKnowledgeSearch } from "../hooks/use-knowledge";
import { getCoverImage, type KnowledgeSearchResult } from "../types";
import { Highlighted, ResultBreadcrumbTitle } from "./knowledge-highlight";

const SearchResultCard = ({ node }: { node: KnowledgeSearchResult }) => {
  const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
  const cover = getCoverImage(node);
  const usedAt = node.lastViewedAt ?? node.updatedAt;

  return (
    <Link href={`/knowledge/${node.id}`} prefetch className="focus-visible:outline-none">
      <Card
        size="sm"
        className={cn(
          "flex-row gap-3 p-3 transition-colors hover:bg-accent/50",
          node.snippet ? "items-start" : "items-center",
        )}
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
  const { data, isLoading } = useKnowledgeSearch(query);

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

  return (
    <div className="flex flex-col gap-2">
      {data.map((node) => (
        <SearchResultCard key={node.id} node={node} />
      ))}
    </div>
  );
};
