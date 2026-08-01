"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyMutation,
  type DrawController,
  type ExcalidrawApi,
  getSceneSummary,
} from "@/features/draw/lib/scene";

// One browser-local scratch canvas. localStorage keeps the drawing across
// refreshes without a round-trip or a DB table — the drawing is personal and
// device-local by design.
const STORAGE_KEY = "draw:scene";
const SAVE_DEBOUNCE_MS = 600;

type ChangeArgs = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["onChange"]>
>;
type SceneElements = ChangeArgs[0];
type BinaryFiles = ChangeArgs[2];

type PersistedScene = {
  elements: SceneElements;
  files: BinaryFiles;
};

/** Reads the saved scene, tolerating a missing or corrupt entry. */
const loadScene = (): PersistedScene | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedScene>;
    if (!Array.isArray(parsed.elements)) return null;
    return {
      elements: parsed.elements as SceneElements,
      files: (parsed.files ?? {}) as BinaryFiles,
    };
  } catch {
    return null;
  }
};

/**
 * The full-surface, persistent Excalidraw whiteboard behind the Draw route.
 * Client-only (loaded via `next/dynamic` with `ssr: false`), it restores the
 * saved scene on mount, debounces saves back to localStorage on every change,
 * and hands a `DrawController` up to the workspace so the chat panel can edit
 * the scene precisely.
 */
export default function DrawCanvas({
  onReady,
}: {
  onReady?: (controller: DrawController) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [api, setApi] = useState<ExcalidrawApi | null>(null);

  // Excalidraw reads initialData once; compute the restored scene a single
  // time so a re-render never resets the board.
  const initialData = useMemo(() => {
    const saved = loadScene();
    return {
      elements: saved?.elements ?? [],
      files: saved?.files ?? undefined,
      scrollToContent: true,
    };
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((elements: SceneElements, files: BinaryFiles) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const payload: PersistedScene = {
          // Drop tombstoned elements so the store doesn't grow unbounded.
          elements: elements.filter(
            (element) => !element.isDeleted,
          ) as SceneElements,
          files,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Storage full or unavailable (private mode) — the drawing still
        // works this session, it just won't survive a refresh.
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Publish the imperative controller once the API is live.
  useEffect(() => {
    if (!api || !onReady) return;
    onReady({
      applyMutation: (mutation) => applyMutation(api, mutation),
      getSceneSummary: () => getSceneSummary(api.getSceneElements()),
    });
  }, [api, onReady]);

  return (
    <div className="size-full">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={initialData}
        onChange={(elements, _appState, files) => persist(elements, files)}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
      />
    </div>
  );
}
