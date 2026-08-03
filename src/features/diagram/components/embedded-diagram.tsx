"use client";

import { Loader2Icon, NetworkIcon, SaveIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import {
  useDiagram,
  useSaveDiagram,
} from "@/features/diagram/hooks/use-diagram";
import type { EmbeddedDiagramApi } from "./embedded-diagram-canvas";

// Excalidraw is a heavy, browser-only bundle, so the canvas is lazy-loaded with
// SSR off and only pulled in for pages that actually embed a diagram.
const EmbeddedDiagramCanvas = dynamic(
  () => import("./embedded-diagram-canvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading canvas…
      </div>
    ),
  },
);

/**
 * An interactive Excalidraw scene embedded inside a page body via the
 * `excalidraw` fenced token. The scene is loaded from the server once into the
 * canvas's `initialData`; anyone can pan/edit/play, but only the owner sees a
 * Save button (everyone else's edits reset on refresh). Each embed is its own
 * canvas keyed by `diagramId`, so scenes and viewports never bleed together.
 */
export const EmbeddedDiagram = ({ diagramId }: { diagramId: string }) => {
  const { isOwner } = useIsOwner();
  const apiRef = useRef<EmbeddedDiagramApi | null>(null);

  const { data, isLoading, isError } = useDiagram(diagramId);
  const save = useSaveDiagram();

  // Read once from the loaded scene; the canvas mounts only after this resolves,
  // and Excalidraw consumes the scene a single time, so a refresh restores the
  // saved scene and discards any in-memory edits.
  const scene = useMemo(
    () =>
      data
        ? {
            elements: data.scene.elements,
            files: data.scene.files ?? undefined,
          }
        : null,
    [data],
  );

  const handleReady = useCallback((api: EmbeddedDiagramApi) => {
    apiRef.current = api;
  }, []);

  const handleSave = () => {
    if (!apiRef.current || save.isPending) return;
    save.mutate({ id: diagramId, scene: apiRef.current.getScene() });
  };

  return (
    <div className="not-prose my-6 overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
        <NetworkIcon className="size-3" />
        {data?.title || "Diagram"}
        {isOwner && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-auto h-7 gap-1.5 px-2 text-xs"
            onClick={handleSave}
            disabled={save.isPending || !data}
          >
            {save.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SaveIcon className="size-3.5" />
            )}
            Save
          </Button>
        )}
      </div>
      <div className="relative h-112 w-full">
        {isError ? (
          <div className="flex h-full items-center justify-center px-3 text-center text-xs text-muted-foreground">
            Couldn't load this diagram.
          </div>
        ) : isLoading || !scene ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Loading diagram…
          </div>
        ) : (
          <EmbeddedDiagramCanvas
            elements={scene.elements}
            files={scene.files}
            onReady={handleReady}
          />
        )}
      </div>
    </div>
  );
};
