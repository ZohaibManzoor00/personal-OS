"use client";

import { Loader2Icon, Wand2Icon } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { HeaderPortal } from "@/components/header-portal";
import { Button } from "@/components/ui/button";
import { DrawChat } from "@/features/draw/components/draw-chat";
import type { DrawController } from "@/features/draw/lib/scene";
import type {
  SceneElementSummary,
  SceneMutation,
} from "@/features/draw/shared/operations";

// Excalidraw is a heavy, browser-only bundle, so the canvas is lazy-loaded with
// SSR off — nothing browser-specific runs on the server.
const DrawCanvas = dynamic(
  () => import("@/features/draw/components/draw-canvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        Loading canvas…
      </div>
    ),
  },
);

export const DrawWorkspace = () => {
  const [chatOpen, setChatOpen] = useState(false);
  // The canvas publishes its imperative controller once Excalidraw is live;
  // held in a ref so toggling the chat never remounts (or resets) the board.
  const controllerRef = useRef<DrawController | null>(null);
  const [ready, setReady] = useState(false);

  const onReady = useCallback((controller: DrawController) => {
    controllerRef.current = controller;
    setReady(true);
  }, []);

  const getScene = useCallback(
    (): SceneElementSummary[] => controllerRef.current?.getSceneSummary() ?? [],
    [],
  );

  const applyMutation = useCallback((mutation: SceneMutation) => {
    controllerRef.current?.applyMutation(mutation);
  }, []);

  return (
    <>
      {/* The page owns no chrome — its title and the assistant toggle live in
          the shared app top-bar, so the canvas gets the whole viewport. */}
      <HeaderPortal>
        <div className="h-5 w-px shrink-0 bg-border" />
        <h1 className="shrink-0 font-heading text-sm font-semibold">Draw</h1>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {!chatOpen && (
            <Button
              type="button"
              size="sm"
              onClick={() => setChatOpen(true)}
              className="gap-1.5"
            >
              <Wand2Icon className="size-4" />
              Ask AI
            </Button>
          )}
        </div>
      </HeaderPortal>

      {/* Canvas stays mounted at all times (so toggling the chat never resets
          the board); the assistant slides in as a fixed-width side panel. */}
      <div className="flex h-[calc(100svh-3.5rem)] min-h-0">
        <div className="min-w-0 flex-1">
          <DrawCanvas onReady={onReady} />
        </div>
        {chatOpen && (
          <div className="w-full max-w-100 shrink-0 border-l border-border sm:w-95 lg:w-105">
            <DrawChat
              getScene={getScene}
              applyMutation={applyMutation}
              ready={ready}
              onClose={() => setChatOpen(false)}
            />
          </div>
        )}
      </div>
    </>
  );
};
