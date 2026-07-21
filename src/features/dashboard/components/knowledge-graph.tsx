"use client";

import { WaypointsIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { resolveSectionLabel } from "@/features/knowledge/lib/sections";
import { useDashboardGraph } from "../hooks/use-dashboard";
import { getSectionColor } from "../lib/section-meta";
import { KnowledgeGraphCanvas } from "./knowledge-graph-canvas";

/**
 * A force-directed map of the whole knowledge base: one hub per section with its
 * spaces and pages orbiting it, colored by section. Drag nodes, scroll to zoom,
 * and click any node to open it.
 */
export const KnowledgeGraph = () => {
  const { data } = useDashboardGraph();

  if (data.nodes.length === 0) return null;

  const sections = Array.from(
    new Set(
      data.nodes
        .filter((node) => node.kind === "SECTION")
        .map((node) => node.section),
    ),
  );

  return (
    <Card className="flex h-full min-h-0 flex-col gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-foreground ring-1 ring-border">
            <WaypointsIcon className="size-4" />
          </span>
          <div className="flex flex-col">
            <h2 className="font-heading text-base font-semibold leading-none">
              Knowledge graph
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag · scroll to zoom · click a node to open
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {sections.map((section) => (
            <span
              key={section}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: getSectionColor(section) }}
              />
              {resolveSectionLabel(section)}
            </span>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 w-full flex-1">
        <KnowledgeGraphCanvas data={data} />
      </div>
    </Card>
  );
};
