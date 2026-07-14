"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { HeaderPortal } from "@/components/header-portal";
import { useKnowledgeNode, useRecordView, useScrolledPast } from "../hooks/use-knowledge";
import { KnowledgeBreadcrumb } from "./knowledge-breadcrumb";
import { KnowledgeEditor } from "./knowledge-editor";
import { KnowledgePageSearch } from "./knowledge-page-search";
import { KnowledgeStickyHeader } from "./knowledge-sticky-header";

export const KnowledgePageView = ({ nodeId }: { nodeId: string }) => {
  const { ref: headerRef, scrolledPast } = useScrolledPast();

  // Shared between the inline (top-of-page) and sticky-header search so the
  // query carries over as the header swaps in/out on scroll.
  const [search, setSearch] = useState("");

  return (
    <div className="flex h-full flex-col gap-6">
      <KnowledgeStickyHeader nodeId={nodeId} visible={scrolledPast} search={search} onSearchChange={setSearch} />
      <HeaderPortal>
        <div className="min-w-0 flex-1">
          <KnowledgeBreadcrumb nodeId={nodeId} />
        </div>
        <KnowledgePageSearch value={search} onChange={setSearch} className="w-64 shrink-0" />
      </HeaderPortal>
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
