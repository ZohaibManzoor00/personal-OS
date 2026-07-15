import type { KnowledgeSearchResult } from "../types";
import { resolveSectionLabel } from "./sections";

export type KnowledgeSearchGroup = {
  section: string;
  label: string;
  results: KnowledgeSearchResult[];
};

/**
 * Group flat search hits (already ranked with the current section first) by
 * their section, preserving hit order within each group and group order by
 * first appearance. The current section is forced to the top so it always
 * leads, even if a stray hit from another section outranks its first result.
 */
export const groupSearchResultsBySection = (
  results: KnowledgeSearchResult[],
  currentSection: string,
): KnowledgeSearchGroup[] => {
  const groups = new Map<string, KnowledgeSearchResult[]>();

  for (const result of results) {
    const existing = groups.get(result.section);
    if (existing) {
      existing.push(result);
    } else {
      groups.set(result.section, [result]);
    }
  }

  return Array.from(groups.entries())
    .map(([section, sectionResults]) => ({
      section,
      label: resolveSectionLabel(section),
      results: sectionResults,
    }))
    .sort((a, b) => {
      if (a.section === currentSection) return -1;
      if (b.section === currentSection) return 1;
      return 0;
    });
};
