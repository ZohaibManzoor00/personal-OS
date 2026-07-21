"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { useTableOfContents } from "../hooks/use-table-of-contents";

const FLASH_CLASS = "knowledge-match-flash";
const FLASH_DURATION = 1800;

/**
 * Sticky "on this page" outline that lists the headings of the current
 * knowledge page and highlights the section in view as the reader scrolls.
 * Clicking an entry smoothly scrolls to that heading. Renders nothing until
 * there are at least two headings to navigate between.
 */
export const KnowledgeToc = ({ rootSelector, className }: { rootSelector: string; className?: string }) => {
  const { items, activeId } = useTableOfContents(rootSelector);

  if (items.length < 2) return null;

  const minLevel = Math.min(...items.map((item) => item.level));

  const handleClick = (event: MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const heading = document.getElementById(id);
    if (!heading) return;
    heading.scrollIntoView({ behavior: "smooth", block: "start" });

    // Briefly flash the heading — same cue as landing on a search match —
    // so the eye catches where it jumped to. Toggling with a reflow restarts
    // the animation if the same heading is clicked again.
    heading.classList.remove(FLASH_CLASS);
    void heading.getBoundingClientRect();
    heading.classList.add(FLASH_CLASS);
    window.setTimeout(() => heading.classList.remove(FLASH_CLASS), FLASH_DURATION);
  };

  return (
    <nav aria-label="On this page" className={cn("text-[0.95rem]", className)}>
      <ul className="flex flex-col border-l border-border">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={(event) => handleClick(event, item.id)}
                style={{ paddingLeft: `${(item.level - minLevel) * 12 + 16}px` }}
                className={cn(
                  "-ml-px block border-l py-1.5 pr-2 leading-snug transition-colors",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <span className="line-clamp-2">{item.text}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
