"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Keyboard hint shown inside the search input. Renders `⌘K` on macOS and
 * `Ctrl K` elsewhere. Only mounts after hydration to avoid a platform-based
 * SSR mismatch. (The secret ⌘L shortcut is intentionally not shown.)
 */
export const SearchKbd = ({ className }: { className?: string }) => {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const isMac = /mac|iphone|ipad|ipod/i.test(
      navigator.platform || navigator.userAgent,
    );
    setLabel(isMac ? "⌘K" : "Ctrl K");
  }, []);

  if (!label) return null;

  return (
    <kbd
      aria-hidden
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center rounded border border-border bg-muted px-1.5 font-sans text-[10px] font-medium text-muted-foreground",
        className,
      )}
    >
      {label}
    </kbd>
  );
};
