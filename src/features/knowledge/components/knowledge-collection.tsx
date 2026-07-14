"use client";

import { useKnowledgeTree, useKnowledgeView } from "../hooks/use-knowledge";
import type { KnowledgeNode } from "../types";
import { KnowledgeGrid } from "./knowledge-grid";
import { KnowledgeTree } from "./knowledge-tree";

type Props = {
  parentId: string | null;
  items: KnowledgeNode[];
};

export const KnowledgeCollection = ({ parentId, items }: Props) => {
  const [view] = useKnowledgeView();
  const treeQuery = useKnowledgeTree(view === "tree");

  if (view === "tree") {
    if (!treeQuery.data) {
      return (
        <p className="px-1 text-sm text-muted-foreground">Loading tree...</p>
      );
    }
    return <KnowledgeTree nodes={treeQuery.data} rootId={parentId} />;
  }

  return <KnowledgeGrid items={items} />;
};
