"use client";

import { FileTextIcon, FolderIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useKnowledgeSearch } from "../hooks/use-knowledge";

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
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No results for "{query}"
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((node) => {
        const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;

        return (
          <Link
            key={node.id}
            href={`/knowledge/${node.id}`}
            prefetch
            className="focus-visible:outline-none"
          >
            <Card
              size="sm"
              className="flex-row items-center gap-3 p-3 transition-colors hover:bg-accent/50"
            >
              <div className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{node.title}</span>
                <span className="text-xs text-muted-foreground">
                  {node.type === "SPACE" ? "Space" : "Page"}
                </span>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
};
