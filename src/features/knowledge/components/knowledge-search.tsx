"use client";

import { SearchTrigger } from "@/features/command-palette/components/search-trigger";
import { useKnowledgeSection } from "./knowledge-section-context";

/**
 * Section-root top-bar search. Renders as a trigger that opens the global
 * command palette (keeping the section's placeholder), so search behaves
 * identically everywhere.
 */
export const KnowledgeSearch = ({ className }: { className?: string }) => {
  const section = useKnowledgeSection();
  return (
    <SearchTrigger className={className} placeholder={section.searchPlaceholder} />
  );
};
