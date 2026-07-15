"use client";

import { FilePlusIcon, FolderPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { HeaderPortal } from "@/components/header-portal";
import { Button } from "@/components/ui/button";
import { RouteCover } from "@/features/route-cover/components/route-cover";
import { useKnowledgeParams, useListChildren } from "../hooks/use-knowledge";
import { KnowledgeCollection } from "./knowledge-collection";
import { KnowledgeEmptyState } from "./knowledge-empty-state";
import { KnowledgeNodeDialog } from "./knowledge-node-dialog";
import { KnowledgeRecent } from "./knowledge-recent";
import { KnowledgeSearch } from "./knowledge-search";
import { KnowledgeSearchResults } from "./knowledge-search-results";
import { useKnowledgeSection } from "./knowledge-section-context";
import { KnowledgeViewToggle } from "./knowledge-view-toggle";

type CreateHandlers = {
  onNewSpace: () => void;
  onNewPage: () => void;
};

export const KnowledgeRootView = () => {
  const router = useRouter();
  const section = useKnowledgeSection();
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
    <div className="flex h-full flex-col">
      <HeaderPortal>
        <div className="min-w-0 flex-1" />
        <KnowledgeSearch className="w-64 shrink-0" />
      </HeaderPortal>
      <RouteCover
        route={section.coverRoute}
        title={section.cover.title}
        description={section.cover.description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handlers.onNewSpace}>
              <FolderPlusIcon className="size-4" />
              <span className="hidden sm:inline">New space</span>
            </Button>
            <Button size="sm" onClick={handlers.onNewPage}>
              <FilePlusIcon className="size-4" />
              <span className="hidden sm:inline">New page</span>
            </Button>
          </>
        }
      >
        <KnowledgeRecentSection />
      </RouteCover>

      <div className="h-full px-4 pt-2 pb-4 md:px-10 md:pt-4 md:pb-6">
        <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-y-4">
          <div className="flex items-center justify-end gap-3">
            <KnowledgeViewToggle />
          </div>

          <ErrorBoundary fallback={<ErrorView message="Error loading content" />}>
            <Suspense fallback={<LoadingView message="Loading..." />}>
              <KnowledgeRootContent {...handlers} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      <KnowledgeNodeDialog
        mode="create"
        type={create.type}
        parentId={null}
        open={create.open}
        onOpenChange={(open) => setCreate((prev) => ({ ...prev, open }))}
        onCreated={(created) => {
          if (created.type === "PAGE")
            router.push(`${section.basePath}/${created.id}?edit=1`);
        }}
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
  const section = useKnowledgeSection();
  const [params] = useKnowledgeParams();
  const { data: items } = useListChildren(null);

  const query = params.search.trim();

  if (query.length > 0) return <KnowledgeSearchResults query={query} />;

  if (items.length === 0) {
    return (
      <KnowledgeEmptyState
        title={section.emptyRoot.title}
        description={section.emptyRoot.description}
        onNewSpace={onNewSpace}
        onNewPage={onNewPage}
      />
    );
  }

  return <KnowledgeCollection parentId={null} items={items} />;
};
