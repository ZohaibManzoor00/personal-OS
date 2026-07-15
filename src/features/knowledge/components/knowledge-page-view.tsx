"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { useKnowledgeNode, useRecordView, useScrolledPast } from "../hooks/use-knowledge";
import { KnowledgeEditor } from "./knowledge-editor";
import { KnowledgeHeaderBar } from "./knowledge-header-bar";
import { KnowledgeStickyHeader } from "./knowledge-sticky-header";

export const KnowledgePageView = ({ nodeId }: { nodeId: string }) => {
  const { ref: headerRef, scrolledPast } = useScrolledPast();

  // Shared between the inline (top-of-page) and sticky-header search so the
  // query carries over as the header swaps in/out on scroll.
  const [search, setSearch] = useState("");

  return (
    <div className="flex h-full flex-col gap-6">
      <KnowledgeStickyHeader nodeId={nodeId} visible={scrolledPast} search={search} onSearchChange={setSearch} />
      <KnowledgeHeaderBar nodeId={nodeId} search={search} onSearchChange={setSearch} />
      <ErrorBoundary fallback={<ErrorView message="Error loading this page" />}>
        <Suspense fallback={<LoadingView message="Loading..." />}>
          <KnowledgePageContent nodeId={nodeId} headerRef={headerRef} />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

const KnowledgePageContent = ({ nodeId, headerRef }: { nodeId: string; headerRef?: React.Ref<HTMLDivElement> }) => {
  const router = useRouter();
  const { data: node } = useKnowledgeNode(nodeId);

  useRecordView(nodeId);

  const goToParent = () => router.push(node.parentId ? `/knowledge/${node.parentId}` : "/knowledge");

  return <KnowledgeEditor nodeId={nodeId} onDeleted={goToParent} sentinelRef={headerRef} />;
};
