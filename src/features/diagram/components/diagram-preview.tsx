"use client";

import { Loader2Icon, NetworkIcon } from "lucide-react";
import dynamic from "next/dynamic";

// Excalidraw is a heavy, browser-only bundle, so it's lazy-loaded with SSR off
// and only pulled in for messages that actually carry a diagram.
const ExcalidrawCanvas = dynamic(() => import("./excalidraw-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Loading canvas…
    </div>
  ),
});

// Mirrors the `diagram` events chat.send streams: a placeholder appears while the
// diagram agent works (`generating`), then fills in with the scene (`done`), or
// is dropped if the agent's output wasn't a real diagram (`empty`).
export type ChatDiagram = {
  id: string;
  status: "generating" | "done" | "empty" | "error";
  mermaid?: string;
};

export const DiagramPreview = ({ diagram }: { diagram: ChatDiagram }) => {
  if (diagram.status === "empty") return null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
        <NetworkIcon className="size-3" />
        Diagram
      </div>
      <div className="relative h-[28rem] w-full">
        {diagram.status === "done" && diagram.mermaid ? (
          <ExcalidrawCanvas mermaid={diagram.mermaid} />
        ) : diagram.status === "error" ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Couldn't render the diagram.
          </div>
        ) : (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Sketching a diagram…
          </div>
        )}
      </div>
    </div>
  );
};
