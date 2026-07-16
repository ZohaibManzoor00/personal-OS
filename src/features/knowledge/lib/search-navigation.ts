import { resolveSectionBasePath } from "./sections";

/**
 * URL query param carrying the active search terms to a knowledge page so the
 * destination can scroll to (and highlight) the first matching reference in the
 * body, instead of just landing at the top.
 */
export const MATCH_PARAM = "q";

/**
 * Builds the href for a knowledge node. When a `query` is given (a page opened
 * from search), it's appended as the match param so the page scrolls to the
 * first hit; pass `undefined` for plain navigation (e.g. spaces/folders).
 */
export const buildNodeHref = (section: string, id: string, query?: string) => {
  const base = `${resolveSectionBasePath(section)}/${id}`;
  const trimmed = query?.trim();
  return trimmed ? `${base}?${MATCH_PARAM}=${encodeURIComponent(trimmed)}` : base;
};
