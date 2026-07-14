"use client";

import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { useKnowledgeParams, useListChildren } from "../hooks/use-knowledge";
import { KnowledgeCollection } from "./knowledge-collection";
import { KnowledgeEmptyState } from "./knowledge-empty-state";
import { KnowledgeHeader } from "./knowledge-header";
import { KnowledgeNodeDialog } from "./knowledge-node-dialog";
import { KnowledgeRecent } from "./knowledge-recent";
import { KnowledgeSearch } from "./knowledge-search";
import { KnowledgeSearchResults } from "./knowledge-search-results";
import { KnowledgeViewToggle } from "./knowledge-view-toggle";

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
      <KnowledgeRecentSection />

      <div className="flex items-center justify-between gap-3">
        <KnowledgeSearch />
        <KnowledgeViewToggle />
      </div>

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

const KnowledgeRecentSection = () => {
  const [params] = useKnowledgeParams();

  if (params.search.trim().length > 0) return null;

  return (
    <ErrorBoundary fallback={null}>
      <Suspense fallback={null}>
        <KnowledgeRecent />
      </Suspense>
    </ErrorBoundary>
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

  return <KnowledgeCollection parentId={null} items={items} />;
};
