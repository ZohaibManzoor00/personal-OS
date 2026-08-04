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

type LooseElement = Record<string, unknown> & {
  id?: string;
  type?: string;
  containerId?: string | null;
};

/**
 * Prepares a stored scene for loading. Excalidraw requires a container's bound
 * text (and an arrow's label) to be its *immediate* successor in fractional-
 * index order; a stored scene can violate that (mermaid- or programmatically-
 * built scenes especially), which trips "Fractional indices invariant for bound
 * elements has been compromised" (fatal in dev) and mis-orders labels on the
 * canvas in prod. So we (1) reorder every bound text to sit right after its
 * container, then (2) drop the stored `index` values so Excalidraw regenerates a
 * consistent set from this corrected order.
 */
const normalizeScene = (raw: unknown[]): Record<string, unknown>[] => {
  const elements = raw as LooseElement[];
  const byId = new Map(elements.map((element) => [element.id, element]));

  const boundTextByContainer = new Map<string, LooseElement>();
  for (const element of elements) {
    if (element.type === "text" && element.containerId) {
      boundTextByContainer.set(element.containerId, element);
    }
  }

  const ordered: LooseElement[] = [];
  for (const element of elements) {
    // A bound text is emitted right after its container below; skip it here.
    // (If its container is missing, fall through and keep it in place.)
    if (
      element.type === "text" &&
      element.containerId &&
      byId.has(element.containerId)
    ) {
      continue;
    }
    ordered.push(element);
    const boundText = element.id
      ? boundTextByContainer.get(element.id)
      : undefined;
    if (boundText) ordered.push(boundText);
  }

  return ordered.map((element) => {
    const { index: _index, ...rest } = element;
    return rest;
  });
};

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

  // Reorder bound text after their containers and regenerate fractional indices,
  // then let restore repair any dangling bindings. Computed once so the board
  // never resets. See `normalizeScene` for why this is required.
  const initialData = useMemo(
    () => ({
      elements: restoreElements(
        normalizeScene(elements) as unknown as Parameters<
          typeof restoreElements
        >[0],
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
