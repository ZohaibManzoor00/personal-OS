"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { useKnowledgeNode } from "../hooks/use-knowledge";
import { KnowledgeBreadcrumb } from "./knowledge-breadcrumb";
import { KnowledgeEditor } from "./knowledge-editor";

export const KnowledgePageView = ({ nodeId }: { nodeId: string }) => {
  return (
    <div className="flex h-full flex-col gap-6">
      <KnowledgeBreadcrumb nodeId={nodeId} />
      <ErrorBoundary fallback={<ErrorView message="Error loading this page" />}>
        <Suspense fallback={<LoadingView message="Loading..." />}>
          <KnowledgePageContent nodeId={nodeId} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

const KnowledgePageContent = ({ nodeId }: { nodeId: string }) => {
  const router = useRouter();
  const { data: node } = useKnowledgeNode(nodeId);

  const goToParent = () =>
    router.push(node.parentId ? `/knowledge/${node.parentId}` : "/knowledge");

  return <KnowledgeEditor nodeId={nodeId} onDeleted={goToParent} />;
};
