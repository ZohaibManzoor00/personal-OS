"use client";

import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCommandPalette } from "../use-command-palette";

/**
 * A button styled like the old header search input. Clicking it (or pressing
 * ⌘K) opens the command palette, so the palette is the single search surface
 * across the app while the header keeps its familiar search-bar look.
 */
export const SearchTrigger = ({
  className,
  placeholder = "Search everything",
}: {
  className?: string;
  placeholder?: string;
}) => {
  const { setOpen } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "flex h-9 items-center gap-2 rounded-md border border-sidebar-primary bg-background pr-2 pl-3 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent/50",
        className,
      )}
    >
      <SearchIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
      <kbd className="pointer-events-none hidden shrink-0 items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
};
