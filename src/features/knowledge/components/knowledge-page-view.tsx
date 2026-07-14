"use client";

import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import {
  useKnowledgeNode,
  useRecordView,
  useScrolledPast,
} from "../hooks/use-knowledge";
import { KnowledgeBreadcrumb } from "./knowledge-breadcrumb";
import { KnowledgeEditor } from "./knowledge-editor";
import { KnowledgeStickyHeader } from "./knowledge-sticky-header";

export const KnowledgePageView = ({ nodeId }: { nodeId: string }) => {
  const { ref: headerRef, scrolledPast } = useScrolledPast();

  return (
    <div className="flex h-full flex-col gap-6">
      <KnowledgeStickyHeader nodeId={nodeId} visible={scrolledPast} />
      <KnowledgeBreadcrumb nodeId={nodeId} />
      <ErrorBoundary fallback={<ErrorView message="Error loading this page" />}>
        <Suspense fallback={<LoadingView message="Loading..." />}>
          <KnowledgePageContent nodeId={nodeId} headerRef={headerRef} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

const KnowledgePageContent = ({
  nodeId,
  headerRef,
}: {
  nodeId: string;
  headerRef?: React.Ref<HTMLDivElement>;
}) => {
  const router = useRouter();
  const { data: node } = useKnowledgeNode(nodeId);

  useRecordView(nodeId);

  const goToParent = () =>
    router.push(node.parentId ? `/knowledge/${node.parentId}` : "/knowledge");

  return (
    <KnowledgeEditor
      nodeId={nodeId}
      onDeleted={goToParent}
      sentinelRef={headerRef}
    />
  );
};
