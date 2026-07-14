"use client";

import {
  FileTextIcon,
  FolderIcon,
  Loader2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useKnowledgeSearch } from "../hooks/use-knowledge";
import { getCoverImage } from "../types";
import { Highlighted, ResultBreadcrumbTitle } from "./knowledge-highlight";

const SEARCH_DEBOUNCE = 250;

/**
 * Compact knowledge search for the page (`/knowledge/[id]`) top bar. Shows hits
 * in a dropdown anchored under the input instead of replacing the page. The
 * query is controlled by the parent so the same value is shared between the
 * inline (top of page) and sticky-header placements.
 */
export const KnowledgePageSearch = ({
  value,
  onChange,
  className,
  align = "right",
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  align?: "left" | "right";
}) => {
  const [focused, setFocused] = useState(false);
  const [deferred, setDeferred] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDeferred(value), SEARCH_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [value]);

  const query = deferred.trim();
  const { data, isLoading } = useKnowledgeSearch(query);
  const open = focused && query.length > 0;

  // Close when clicking/tapping outside the search.
  useEffect(() => {
    if (!focused) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [focused]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="bg-background pr-8 pl-9"
          placeholder="Search knowledge"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setFocused(false);
              event.currentTarget.blur();
            }
          }}
        />
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className={cn(
            "absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-opacity hover:text-foreground",
            value ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {open ? (
        <div
          className={cn(
            "absolute z-40 mt-2 max-h-[70vh] w-[24rem] max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border border-border bg-popover p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
            </div>
          ) : !data || data.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            data.map((node) => {
              const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
              const cover = getCoverImage(node);

              return (
                <Link
                  key={node.id}
                  href={`/knowledge/${node.id}`}
                  prefetch
                  onClick={() => setFocused(false)}
                  className="flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                >
                  {cover ? (
                    // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
                    <img
                      src={cover.url}
                      alt={cover.altText ?? node.title}
                      className="size-8 shrink-0 rounded-md object-cover ring-1 ring-border"
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col">
                    <ResultBreadcrumbTitle
                      breadcrumb={node.breadcrumb}
                      titleHighlight={node.titleHighlight}
                    />
                    {node.snippet ? (
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        <Highlighted value={node.snippet} />
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/70">
                        {node.type === "SPACE" ? "Space" : "Page"}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
};
