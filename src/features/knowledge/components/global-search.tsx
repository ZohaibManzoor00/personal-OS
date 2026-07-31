"use client";

import { HeaderPortal } from "@/components/header-portal";
import { SearchTrigger } from "@/features/command-palette/components/search-trigger";

/**
 * Fills the dashboard top-bar with the search trigger. Clicking it (or pressing
 * ⌘K) opens the global command palette, which is the single search surface for
 * the whole app.
 */
export const GlobalSearch = () => (
  <HeaderPortal>
    <div className="min-w-0 flex-1" />
    <SearchTrigger className="w-64 shrink-0" />
  </HeaderPortal>
);
