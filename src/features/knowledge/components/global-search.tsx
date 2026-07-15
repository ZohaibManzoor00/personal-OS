"use client";

import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { HeaderPortal } from "@/components/header-portal";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useGlobalSearch,
  useKnowledgeParams,
  useSearchFocusHotkey,
} from "../hooks/use-knowledge";
import { groupSearchResultsBySection } from "../lib/group-results";
import { SearchResultCard } from "./knowledge-search-results";

/**
 * Global search input for the app top-bar (`AppHeader`). Writes the query into
 * the shared `search` URL param (like the per-section search on `/learnings`),
 * so the dashboard content swaps to results instead of showing a dropdown.
 */
export const GlobalSearch = ({ className }: { className?: string }) => {
  const [params, setParams] = useKnowledgeParams();
  const [value, setValue] = useState(params.search);
  const inputRef = useRef<HTMLInputElement>(null);

  useSearchFocusHotkey(inputRef);

  useEffect(() => {
    setValue(params.search);
  }, [params.search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value !== params.search) setParams({ search: value });
    }, 300);

    return () => clearTimeout(timer);
  }, [value, params.search, setParams]);

  return (
    <HeaderPortal>
      <div className="min-w-0 flex-1" />
      <div className={cn("relative w-64 shrink-0", className)}>
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          data-knowledge-search-input
          className="bg-background pr-9 pl-9"
          placeholder="Search everything"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Tab" || event.shiftKey) return;
            const first = document.querySelector<HTMLElement>(
              "[data-search-result]",
            );
            if (first) {
              event.preventDefault();
              first.focus();
            }
          }}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setValue("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </HeaderPortal>
  );
};

/**
 * Full-view search results across every knowledge hub, grouped by section.
 * Mirrors `KnowledgeSearchResults` but is section-agnostic so it can back the
 * dashboard's global search.
 */
export const GlobalSearchResults = ({ query }: { query: string }) => {
  const { data, isLoading } = useGlobalSearch(query);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep Tab / Shift+Tab moving strictly between result items, falling back to
  // the search input at the top.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key !== "Tab") return;

    const items = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>(
        "[data-search-result]",
      ) ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;

    if (event.shiftKey) {
      event.preventDefault();
      if (index === 0) {
        document
          .querySelector<HTMLElement>("[data-knowledge-search-input]")
          ?.focus();
      } else {
        items[index - 1]?.focus();
      }
      return;
    }

    if (index < items.length - 1) {
      event.preventDefault();
      items[index + 1]?.focus();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2Icon className="size-5 animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No results for "{query}"
      </div>
    );
  }

  const groups = groupSearchResultsBySection(data, "");

  return (
    <div ref={containerRef} className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.section} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </h3>
          {group.results.map((node) => (
            <SearchResultCard
              key={node.id}
              node={node}
              onKeyDown={handleKeyDown}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Swaps the dashboard's main content for global search results whenever there's
 * an active query, otherwise renders the normal dashboard content.
 */
export const GlobalSearchContent = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [params] = useKnowledgeParams();
  const query = params.search.trim();

  if (query.length > 0) return <GlobalSearchResults query={query} />;

  return <>{children}</>;
};
