"use client";

import { createContext, useContext } from "react";
import type { KnowledgeSectionConfig } from "../lib/sections";

const KnowledgeSectionContext = createContext<KnowledgeSectionConfig | null>(null);

/**
 * Makes the active route's config available to every knowledge component below
 * it, so the same UI can be dropped onto any route (learnings, career, …) with
 * only the config differing. Rendered by each route's page/node views.
 */
export const KnowledgeSectionProvider = ({
  config,
  children,
}: {
  config: KnowledgeSectionConfig;
  children: React.ReactNode;
}) => <KnowledgeSectionContext.Provider value={config}>{children}</KnowledgeSectionContext.Provider>;

export const useKnowledgeSection = (): KnowledgeSectionConfig => {
  const config = useContext(KnowledgeSectionContext);
  if (!config) {
    throw new Error("useKnowledgeSection must be used within a KnowledgeSectionProvider");
  }
  return config;
};
