"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { MATCH_PARAM } from "../lib/search-navigation";

const HIGHLIGHT_NAME = "knowledge-search-match";
// Clears the fixed sticky header (h-14) so the match isn't hidden under it —
// matches the `scroll-mt-24` applied to headings.
const SCROLL_OFFSET = 96;
// Give the body (and any images shifting layout) a few frames to settle before
// giving up on finding the match.
const MAX_FRAMES = 30;

const highlightAndScroll = (range: Range) => {
  const rect = range.getBoundingClientRect();
  const top = window.scrollY + rect.top - SCROLL_OFFSET;
  window.scrollTo({ top: Math.max(top, 0), behavior: "smooth" });

  // Precise, non-destructive highlight over the exact matched text via the CSS
  // Custom Highlight API (no DOM mutation, so it never fights React).
  const highlights = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
  const HighlightCtor = (window as unknown as { Highlight?: new (range: Range) => unknown }).Highlight;
  if (highlights && HighlightCtor) {
    highlights.set(HIGHLIGHT_NAME, new HighlightCtor(range));
    window.setTimeout(() => highlights.delete(HIGHLIGHT_NAME), 2600);
    return;
  }

  // Fallback for browsers without the Custom Highlight API: briefly flash the
  // block that contains the match.
  const block = range.startContainer.parentElement?.closest("p, li, h1, h2, h3, h4, blockquote, td, th, pre");
  if (block) {
    block.classList.add("knowledge-match-flash");
    window.setTimeout(() => block.classList.remove("knowledge-match-flash"), 2400);
  }
};

/** Scrolls to the earliest occurrence of any term within `root`. */
const scrollToFirstMatch = (root: HTMLElement, terms: string[]) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const text = node.nodeValue ?? "";
    const lower = text.toLowerCase();

    let bestIndex = -1;
    let bestLength = 0;
    for (const term of terms) {
      const index = lower.indexOf(term);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
        bestLength = term.length;
      }
    }

    if (bestIndex !== -1) {
      const range = document.createRange();
      range.setStart(node, bestIndex);
      range.setEnd(node, Math.min(bestIndex + bestLength, text.length));
      highlightAndScroll(range);
      return true;
    }

    node = walker.nextNode() as Text | null;
  }

  return false;
};

/**
 * When the current page was opened from search (carrying the `q` param), scrolls
 * to and highlights the first reference of the query inside `rootSelector`, then
 * strips the param so a refresh or back/forward won't re-trigger the jump.
 */
export const useScrollToMatch = (rootSelector: string) => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const query = searchParams.get(MATCH_PARAM);

  useEffect(() => {
    if (!query) return;

    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/[^\p{L}\p{N}]+/gu, ""))
      .filter((term) => term.length > 1);

    let cancelled = false;
    let frames = 0;

    const clear = () => router.replace(pathname, { scroll: false });

    const run = () => {
      if (cancelled) return;

      const root = document.querySelector<HTMLElement>(rootSelector);
      if (!root || !root.textContent?.trim()) {
        if (frames++ < MAX_FRAMES) requestAnimationFrame(run);
        else clear();
        return;
      }

      if (terms.length > 0) scrollToFirstMatch(root, terms);
      clear();
    };

    requestAnimationFrame(run);

    return () => {
      cancelled = true;
    };
  }, [query, rootSelector, router, pathname]);
};
