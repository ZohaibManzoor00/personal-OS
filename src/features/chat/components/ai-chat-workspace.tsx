"use client";

import { MessageCircleIcon, WaypointsIcon } from "lucide-react";
import { Suspense, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KnowledgeGraph } from "@/features/dashboard/components/knowledge-graph";
import { cn } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";

type View = "chat" | "graph";

export const AiChatWorkspace = () => {
  const [view, setView] = useState<View>("chat");

  return (
    // Pin the workspace to the viewport (minus the app header + container
    // padding) so the page itself never scrolls; only the message list does.
    <div className="flex h-[calc(100svh-5.5rem)] min-h-0 flex-col gap-4 md:h-[calc(100svh-6.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <h1 className="font-heading text-xl font-semibold">AI Chat</h1>
          <p className="text-sm text-muted-foreground">
            Chat with your knowledge, or explore it as a graph.
          </p>
        </div>

        <ToggleGroup
          type="single"
          variant="outline"
          value={view}
          onValueChange={(value) => value && setView(value as View)}
          className="shrink-0"
        >
          <ToggleGroupItem value="chat" className="gap-1.5 px-3 text-sm">
            <MessageCircleIcon className="size-4" />
            Chat
          </ToggleGroupItem>
          <ToggleGroupItem value="graph" className="gap-1.5 px-3 text-sm">
            <WaypointsIcon className="size-4" />
            Graph
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Both views stay mounted so switching preserves chat history and keeps
          the graph simulation warm; the inactive one is just hidden. */}
      <div className="min-h-0 flex-1">
        <div className={cn("h-full", view !== "chat" && "hidden")}>
          <ChatPanel />
        </div>
        <div className={cn("h-full", view !== "graph" && "hidden")}>
          <ErrorBoundary
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Couldn't load the graph.
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="h-full animate-pulse rounded-xl bg-muted/40" />
              }
            >
              <KnowledgeGraph />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};
