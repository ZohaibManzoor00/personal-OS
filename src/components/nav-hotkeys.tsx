"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Repurposes the VS Code zoom shortcuts as history navigation, so the same
 * muscle memory "zooms out" (back) and "zooms in" (forward) through pages.
 * Ctrl+- → back, Ctrl+= / Ctrl++ → forward.
 */
export const NavHotkeys = () => {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === "-") {
        event.preventDefault();
        router.back();
      } else if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        router.forward();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
};
