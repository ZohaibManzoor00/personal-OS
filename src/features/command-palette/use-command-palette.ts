"use client";

import { useEffect, useSyncExternalStore } from "react";

// Module-level store so any trigger (the header search button, the global
// hotkey, a future menu item) drives the same palette instance mounted once in
// the app shell. Mirrors the `useKnowledgeView` store pattern.
let open = false;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setCommandPaletteOpen = (next: boolean) => {
  if (next === open) return;
  open = next;
  emit();
};

export const toggleCommandPalette = () => setCommandPaletteOpen(!open);

/** Reactive access to the palette's open state plus its setters. */
export const useCommandPalette = () => {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );

  return {
    open: isOpen,
    setOpen: setCommandPaletteOpen,
    toggle: toggleCommandPalette,
  } as const;
};

/**
 * Binds the global palette shortcut: ⌘K / Ctrl+K (advertised) and the
 * intentionally-undocumented ⌘L / Ctrl+L. Mounted once alongside the palette.
 * The keystroke fires regardless of focus (including inside inputs/editor) so
 * the palette is always one chord away.
 */
export const useCommandPaletteHotkey = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key !== "k" && key !== "l") return;

      event.preventDefault();
      toggleCommandPalette();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
};
