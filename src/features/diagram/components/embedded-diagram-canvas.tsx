"use client";

import { Excalidraw, restoreElements } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from "next-themes";
import { type ComponentProps, useEffect, useMemo, useState } from "react";

// The imperative API handle Excalidraw hands back, derived from the prop so we
// don't depend on a deep type import path (same trick as the draw canvas).
type ExcalidrawApi = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

type BinaryFiles = ReturnType<ExcalidrawApi["getFiles"]>;

/** Reading the live scene back out for a save (elements + any pasted images). */
export type EmbeddedDiagramApi = {
  getScene: () => {
    // A mutable copy (not the readonly array Excalidraw exposes) so it satisfies
    // the save mutation's plain-array input.
    elements: ReturnType<ExcalidrawApi["getSceneElements"]>[number][];
    files: BinaryFiles;
  };
};

/**
 * One embedded, standalone Excalidraw scene. Client-only (loaded via
 * `next/dynamic` with `ssr: false`), it renders the stored scene once, so any
 * edits a viewer makes live only in memory and vanish on refresh. There is
 * deliberately no `onChange` persistence here; the owner saves explicitly via
 * the parent, which reads the current scene through the published
 * `EmbeddedDiagramApi`.
 */
export default function EmbeddedDiagramCanvas({
  elements,
  files,
  onReady,
}: {
  elements: unknown[];
  files?: Record<string, unknown> | undefined;
  onReady?: (api: EmbeddedDiagramApi) => void;
}) {
  const { resolvedTheme } = useTheme();
  const [api, setApi] = useState<ExcalidrawApi | null>(null);

  // Drop each element's stored fractional `index` so Excalidraw regenerates
  // contiguous indices from the array order, and repair dangling bindings. A
  // stored scene keeps its raw indices, and `restore` won't touch ones it deems
  // valid — but a container's bound text must sit immediately after it in index
  // order, an adjacency the round-trip can break. Without this, Excalidraw
  // throws "Fractional indices invariant for bound elements has been
  // compromised" (fatal in dev). Computed once so the board never resets.
  const initialData = useMemo(
    () => ({
      elements: restoreElements(
        elements.map((element) => {
          const { index: _index, ...rest } = element as Record<string, unknown>;
          return rest;
        }) as unknown as Parameters<typeof restoreElements>[0],
        null,
        { repairBindings: true },
      ),
      files: files as BinaryFiles | undefined,
      scrollToContent: true,
    }),
    [elements, files],
  );

  useEffect(() => {
    if (!api || !onReady) return;
    onReady({
      getScene: () => ({
        // Drop tombstoned elements so a save doesn't grow the stored scene.
        elements: api
          .getSceneElements()
          .filter((element) => !element.isDeleted),
        files: api.getFiles(),
      }),
    });
  }, [api, onReady]);

  return (
    <Excalidraw
      excalidrawAPI={setApi}
      initialData={initialData}
      theme={resolvedTheme === "dark" ? "dark" : "light"}
    />
  );
}
