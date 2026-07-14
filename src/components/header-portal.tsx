"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const APP_HEADER_SLOT_ID = "app-header-slot";

/**
 * Renders its children into the app top-bar (`AppHeader`) slot via a portal, so
 * a page can fill the otherwise-empty header without the shared layout needing
 * to know about page-specific content. Context (tRPC, query client, etc.) still
 * flows from the React parent, not the DOM parent.
 */
export function HeaderPortal({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(APP_HEADER_SLOT_ID));
  }, []);

  return target ? createPortal(children, target) : null;
}
