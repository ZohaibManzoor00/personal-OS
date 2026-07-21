"use client";

import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorView, LoadingView } from "@/components/entity-component";
import { useKnowledgeNode, useRecordView, useScrolledPast } from "../hooks/use-knowledge";
import { useScrollToMatch } from "../hooks/use-scroll-to-match";
import { KnowledgeEditor } from "./knowledge-editor";
import { KnowledgeHeaderBar } from "./knowledge-header-bar";
import { useKnowledgeSection } from "./knowledge-section-context";
import { KnowledgeStickyHeader } from "./knowledge-sticky-header";
import { KnowledgeToc } from "./knowledge-toc";

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
  const section = useKnowledgeSection();
  const { data: node } = useKnowledgeNode(nodeId);

  useRecordView(nodeId);
  useScrollToMatch("[data-knowledge-body]");

  const goToParent = () => router.push(node.parentId ? `${section.basePath}/${node.parentId}` : section.basePath);

  return (
    <div className="flex items-start gap-8">
      <KnowledgeToc
        rootSelector="[data-knowledge-body]"
        className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-64 shrink-0 self-start overflow-y-auto py-1 xl:block"
      />
      <div className="min-w-0 flex-1 rounded-xl border bg-card p-6 shadow-sm sm:p-8 lg:p-10">
        <KnowledgeEditor nodeId={nodeId} onDeleted={goToParent} sentinelRef={headerRef} />
      </div>
    </div>
  );
};
