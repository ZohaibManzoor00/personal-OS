"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import type { Node as KnowledgeNode } from "@/generated/prisma/client";
import { useKnowledgeNode, useListChildren } from "../hooks/use-knowledge";
import { KnowledgeBreadcrumb } from "./knowledge-breadcrumb";
import { KnowledgeEmptyState } from "./knowledge-empty-state";
import { KnowledgeGrid } from "./knowledge-grid";
import { KnowledgeHeader } from "./knowledge-header";
import { KnowledgeNodeDialog } from "./knowledge-node-dialog";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";

type CreateHandlers = {
  onNewSpace: () => void;
  onNewPage: () => void;
};

export const KnowledgeSpaceView = ({ nodeId }: { nodeId: string }) => {
  const router = useRouter();
  const { data: node } = useKnowledgeNode(nodeId);

  const [create, setCreate] = useState<{
    open: boolean;
    type: "SPACE" | "PAGE";
  }>({ open: false, type: "PAGE" });
  const openCreate = (type: "SPACE" | "PAGE") =>
    setCreate({ open: true, type });

  const handlers: CreateHandlers = {
    onNewSpace: () => openCreate("SPACE"),
    onNewPage: () => openCreate("PAGE"),
  };

  const goToParent = () =>
    router.push(node.parentId ? `/knowledge/${node.parentId}` : "/knowledge");

  return (
    <div className="flex flex-col gap-8">
      <KnowledgeBreadcrumb nodeId={nodeId} />
      <KnowledgeHeader
        title={node.title}
        {...handlers}
        actions={
          <KnowledgeNodeMenu
            node={node as KnowledgeNode}
            onDeleted={goToParent}
          />
        }
      />

      <ErrorBoundary
        fallback={<ErrorView message="Error loading this space" />}
      >
        <Suspense fallback={<LoadingView message="Loading..." />}>
          <KnowledgeSpaceChildren nodeId={nodeId} {...handlers} />
        </Suspense>
      </ErrorBoundary>

      <KnowledgeNodeDialog
        mode="create"
        type={create.type}
        parentId={nodeId}
        open={create.open}
        onOpenChange={(open) => setCreate((prev) => ({ ...prev, open }))}
        onCreated={(created) => {
          if (created.type === "PAGE") router.push(`/knowledge/${created.id}`);
        }}
      />
    </div>
  );
};

const KnowledgeSpaceChildren = ({
  nodeId,
  onNewSpace,
  onNewPage,
}: { nodeId: string } & CreateHandlers) => {
  const { data: items } = useListChildren(nodeId);

  if (items.length === 0) {
    return (
      <KnowledgeEmptyState
        title="This space is empty"
        description="Add a page to start writing, or create a nested space to organize further."
        onNewSpace={onNewSpace}
        onNewPage={onNewPage}
      />
    );
  }

  return <KnowledgeGrid items={items} />;
};
