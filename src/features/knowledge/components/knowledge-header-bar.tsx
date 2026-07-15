"use client";

import { formatDistanceToNow } from "date-fns";
import { HeaderPortal } from "@/components/header-portal";
import { useKnowledgeNode } from "../hooks/use-knowledge";
import { KnowledgeBreadcrumb } from "./knowledge-breadcrumb";
import { KnowledgePageSearch } from "./knowledge-page-search";

/**
 * Fills the shared app top-bar (`AppHeader`) for a knowledge node: a divider
 * after the sidebar toggle, the breadcrumb trail, the last-updated time, and
 * search. Used by both the page and space (folder) views so they present an
 * identical header.
 */
export const KnowledgeHeaderBar = ({
  nodeId,
  search,
  onSearchChange,
}: {
  nodeId: string;
  search: string;
  onSearchChange: (value: string) => void;
}) => {
  const { data: node } = useKnowledgeNode(nodeId);

  return (
    <HeaderPortal>
      <div className="h-5 w-px shrink-0 bg-border" />
      <div className="min-w-0 flex-1">
        <KnowledgeBreadcrumb nodeId={nodeId} />
      </div>
      <span className="hidden shrink-0 text-xs text-muted-foreground lg:block">
        Updated {formatDistanceToNow(node.updatedAt, { addSuffix: true })}
      </span>
      <KnowledgePageSearch value={search} onChange={onSearchChange} className="w-64 shrink-0" />
    </HeaderPortal>
  );
};
