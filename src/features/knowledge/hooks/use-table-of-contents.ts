"use client";

import { useEffect, useState } from "react";

export type TocItem = { id: string; text: string; level: number };

const HEADING_SELECTOR = "h1[id], h2[id], h3[id]";

// Distance from the top of the viewport at which a heading is treated as the
// active section. Clears the fixed sticky header (h-14 = 56px) with a little
// breathing room, and matches the `scroll-mt` applied to headings.
const ACTIVE_OFFSET = 96;

/**
 * Builds a table of contents from the rendered headings inside `rootSelector`
 * and tracks which one is currently active as the window scrolls. Re-scans when
 * the content changes (e.g. switching in/out of edit mode or editing the body)
 * via a MutationObserver, so it needs no explicit content dependency.
 */
export const useTableOfContents = (rootSelector: string) => {
  const [items, setItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) {
      setItems([]);
      return;
    }

    const collect = () => {
      // Ignore headings rendered inside an embedded diagram — Excalidraw's own UI
      // ("Shapes", "Canvas actions", …) would otherwise pollute the outline and
      // churn as the board re-renders (e.g. on sidebar toggle).
      const headings = Array.from(
        root.querySelectorAll<HTMLElement>(HEADING_SELECTOR),
      ).filter((el) => !el.closest("[data-diagram-embed]"));
      setItems((prev) => {
        const next = headings.map((el) => ({ id: el.id, text: el.textContent?.trim() ?? "", level: Number(el.tagName[1]) }));
        // Skip the state update (and downstream effects) when nothing changed,
        // so re-renders from the surrounding editor don't churn.
        const same = prev.length === next.length && prev.every((item, i) => item.id === next[i].id && item.text === next[i].text);
        return same ? prev : next;
      });
    };

    collect();
    const observer = new MutationObserver(collect);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [rootSelector]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveId(null);
      return;
    }

    let frame = 0;

    const update = () => {
      frame = 0;
      // Active heading is the last one whose top has scrolled above the offset;
      // fall back to the first heading before we've scrolled to any.
      let current = items[0]?.id ?? null;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - ACTIVE_OFFSET <= 0) current = item.id;
        else break;
      }
      setActiveId(current);
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  return { items, activeId };
};
