import {
  convertToExcalidrawElements,
  type Excalidraw,
} from "@excalidraw/excalidraw";
import type { ComponentProps } from "react";
import type {
  SceneElementSummary,
  SceneMutation,
  ShapeSpec,
} from "@/features/draw/shared/operations";

// The imperative handle Excalidraw hands back. Derived from the component prop
// so we don't depend on a deep type import path (same trick as the canvas).
export type ExcalidrawApi = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

type SceneElement = ReturnType<ExcalidrawApi["getSceneElements"]>[number];
type Skeleton = NonNullable<
  Parameters<typeof convertToExcalidrawElements>[0]
>[number];

/**
 * The imperative surface the canvas exposes to the rest of the Draw feature
 * (the chat panel), so it can push agent edits in and read the scene out
 * without owning the Excalidraw API itself.
 */
export type DrawController = {
  applyMutation: (mutation: SceneMutation) => void;
  getSceneSummary: () => SceneElementSummary[];
};

// Defaults so the agent can specify only what it cares about (a label, a
// position) and still get a sensibly-sized shape.
const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_CONNECTOR_WIDTH = 120;

/**
 * Maps one agent shape spec onto an Excalidraw element skeleton. `knownIds` is
 * the set of shape ids present in the *same batch*: Excalidraw throws if an
 * arrow binds to an id it can't find in the batch, so a binding to anything not
 * in this set is dropped and the connector falls back to its own coordinates.
 */
const specToSkeleton = (spec: ShapeSpec, knownIds: Set<string>): Skeleton => {
  const { id, type, x, y, width, height, text, strokeColor, backgroundColor } =
    spec;

  if (type === "text") {
    return {
      type: "text",
      id,
      x,
      y,
      text: text ?? "",
      ...(strokeColor ? { strokeColor } : {}),
    } as Skeleton;
  }

  if (type === "arrow" || type === "line") {
    const bindStart = spec.start && knownIds.has(spec.start);
    const bindEnd = spec.end && knownIds.has(spec.end);
    return {
      type,
      id,
      x,
      y,
      width: width ?? DEFAULT_CONNECTOR_WIDTH,
      height: height ?? 0,
      // Only bind to endpoints that live in this same batch; a reference to an
      // already-on-canvas shape (or a typo) would otherwise crash the convert.
      ...(bindStart ? { start: { id: spec.start } } : {}),
      ...(bindEnd ? { end: { id: spec.end } } : {}),
      ...(text ? { label: { text } } : {}),
      ...(strokeColor ? { strokeColor } : {}),
    } as Skeleton;
  }

  // rectangle | ellipse | diamond — a labelled container.
  return {
    type,
    id,
    x,
    y,
    width: width ?? DEFAULT_NODE_WIDTH,
    height: height ?? DEFAULT_NODE_HEIGHT,
    ...(text ? { label: { text } } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
  } as Skeleton;
};

/**
 * Converts agent shape specs into real Excalidraw elements, preserving the ids
 * the agent assigned (`regenerateIds: false`) so a later turn can target them.
 * Bindings that point outside the batch are stripped up front (see
 * `specToSkeleton`), and the whole convert is guarded so one malformed shape
 * can't take down the canvas.
 */
export const specsToElements = (shapes: ShapeSpec[]) => {
  const knownIds = new Set(shapes.map((shape) => shape.id));
  try {
    return convertToExcalidrawElements(
      shapes.map((shape) => specToSkeleton(shape, knownIds)),
      { regenerateIds: false },
    );
  } catch (error) {
    console.error("draw: failed to convert shapes to elements", error);
    return [];
  }
};

// A fresh identity/version so Excalidraw treats the element as changed and
// re-renders it after updateScene.
const bump = <T extends SceneElement>(element: T): T => ({
  ...element,
  version: (element.version ?? 0) + 1,
  versionNonce: Math.floor(Math.random() * 2 ** 31),
  updated: Date.now(),
});

/**
 * Applies one streamed mutation to the live scene, in place and by id. This is
 * the whole point of the Draw route: edits are surgical — only the targeted
 * shapes change, everything the user drew stays put.
 */
export const applyMutation = (api: ExcalidrawApi, mutation: SceneMutation) => {
  const current = api.getSceneElements();

  if (mutation.op === "add") {
    const added = specsToElements(mutation.shapes);
    if (added.length === 0) return;
    api.updateScene({ elements: [...current, ...added] });
    // Bring the new work into view without wrenching the whole viewport.
    api.scrollToContent(added, { fitToContent: true, animate: true });
    return;
  }

  if (mutation.op === "clear") {
    api.updateScene({ elements: [] });
    return;
  }

  if (mutation.op === "delete") {
    const ids = new Set(mutation.ids);
    const next = current.filter(
      (element) =>
        !ids.has(element.id) &&
        // Drop a container's bound label along with it.
        !(
          element.type === "text" &&
          element.containerId != null &&
          ids.has(element.containerId)
        ),
    );
    api.updateScene({ elements: next });
    return;
  }

  // op === "update": patch matched elements in place.
  const patchById = new Map(mutation.updates.map((u) => [u.id, u]));
  const next = current.map((element) => {
    const patch = patchById.get(element.id);
    let changed = element;
    const overrides: Record<string, unknown> = {};

    if (patch) {
      if (patch.x !== undefined) overrides.x = patch.x;
      if (patch.y !== undefined) overrides.y = patch.y;
      if (patch.width !== undefined) overrides.width = patch.width;
      if (patch.height !== undefined) overrides.height = patch.height;
      if (patch.strokeColor !== undefined)
        overrides.strokeColor = patch.strokeColor;
      if (patch.backgroundColor !== undefined)
        overrides.backgroundColor = patch.backgroundColor;
      // A standalone text element carries its own text.
      if (patch.text !== undefined && element.type === "text") {
        overrides.text = patch.text;
        overrides.originalText = patch.text;
      }
    }

    // A container's label lives in a separate bound text element, so a text
    // change on the container id lands here.
    if (
      element.type === "text" &&
      element.containerId != null &&
      patchById.get(element.containerId)?.text !== undefined
    ) {
      const labelText = patchById.get(element.containerId)?.text ?? "";
      overrides.text = labelText;
      overrides.originalText = labelText;
    }

    if (Object.keys(overrides).length > 0) {
      changed = bump({
        ...element,
        ...overrides,
      } as SceneElement) as typeof element;
    }
    return changed;
  });

  api.updateScene({ elements: next });
};

/**
 * Serializes the current scene into the compact, id-addressable summary the
 * agent needs to reason about what's already drawn. A container's label is
 * folded into the container's row so the agent sees one shape, not two.
 */
export const getSceneSummary = (
  elements: readonly SceneElement[],
): SceneElementSummary[] => {
  const textByContainer = new Map<string, string>();
  for (const element of elements) {
    if (element.type === "text" && element.containerId != null) {
      textByContainer.set(element.containerId, element.text);
    }
  }

  const summary: SceneElementSummary[] = [];
  for (const element of elements) {
    // Bound labels are represented via their container's row.
    if (element.type === "text" && element.containerId != null) continue;
    const text =
      element.type === "text" ? element.text : textByContainer.get(element.id);
    summary.push({
      id: element.id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      ...(text ? { text } : {}),
    });
  }
  return summary.slice(0, 500);
};
