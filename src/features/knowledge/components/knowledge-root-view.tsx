"use client";

import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { useKnowledgeParams, useListChildren } from "../hooks/use-knowledge";
import { KnowledgeEmptyState } from "./knowledge-empty-state";
import { KnowledgeGrid } from "./knowledge-grid";
import { KnowledgeHeader } from "./knowledge-header";
import { KnowledgeNodeDialog } from "./knowledge-node-dialog";
import { KnowledgeSearch } from "./knowledge-search";
import { KnowledgeSearchResults } from "./knowledge-search-results";

type CreateHandlers = {
  onNewSpace: () => void;
  onNewPage: () => void;
};

export const KnowledgeRootView = () => {
  const [create, setCreate] = useState<{
    open: boolean;
    type: "SPACE" | "PAGE";
  }>({ open: false, type: "SPACE" });
  const openCreate = (type: "SPACE" | "PAGE") =>
    setCreate({ open: true, type });

  const handlers: CreateHandlers = {
    onNewSpace: () => openCreate("SPACE"),
    onNewPage: () => openCreate("PAGE"),
  };

  return (
    <div className="flex flex-col gap-8">
      <KnowledgeHeader
        title="Knowledge"
        description="Your personal knowledge base"
        {...handlers}
      />
      <KnowledgeSearch />

      <ErrorBoundary fallback={<ErrorView message="Error loading knowledge" />}>
        <Suspense fallback={<LoadingView message="Loading knowledge..." />}>
          <KnowledgeRootContent {...handlers} />
        </Suspense>
      </ErrorBoundary>

      <KnowledgeNodeDialog
        mode="create"
        type={create.type}
        parentId={null}
        open={create.open}
        onOpenChange={(open) => setCreate((prev) => ({ ...prev, open }))}
      />
    </div>
  );
};

const KnowledgeRootContent = ({ onNewSpace, onNewPage }: CreateHandlers) => {
  const [params] = useKnowledgeParams();
  const { data: items } = useListChildren(null);

  const query = params.search.trim();

  if (query.length > 0) return <KnowledgeSearchResults query={query} />;

  if (items.length === 0) {
    return (
      <KnowledgeEmptyState
        title="Start your knowledge base"
        description="Create your first space to begin organizing everything you know."
        onNewSpace={onNewSpace}
        onNewPage={onNewPage}
      />
    );
  }

  return <KnowledgeGrid items={items} />;
};
