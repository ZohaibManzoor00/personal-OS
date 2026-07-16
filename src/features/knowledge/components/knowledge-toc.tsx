"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";
import { useTableOfContents } from "../hooks/use-table-of-contents";

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
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav aria-label="On this page" className={cn("text-sm", className)}>
      <p className="mb-3 pl-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">On this page</p>
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
                  "-ml-px block border-l py-1 pr-2 leading-snug transition-colors",
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
