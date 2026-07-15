"use client";

import { formatDistanceToNow } from "date-fns";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useAncestors, useKnowledgeNode, useScrollProgress } from "../hooks/use-knowledge";
import { KnowledgePageSearch } from "./knowledge-page-search";

/**
 * Overlay bar that slides down and pins to the top of the page once the main
 * header has scrolled out of view. It's `fixed` and sized to the sidebar-inset
 * (measured live) so its border spans the full width of the content pane while
 * staying clear of the sidebar, even as the sidebar collapses/expands.
 */
export const KnowledgeStickyHeader = ({
  nodeId,
  visible,
  search,
  onSearchChange,
}: {
  nodeId: string;
  visible: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}) => {
  const { data: node } = useKnowledgeNode(nodeId);
  const { data: ancestors } = useAncestors(nodeId);
  const progress = useScrollProgress();

  // The current node is the last ancestor — drop it so the trail only shows
  // the path leading up to the title we render alongside it.
  const trail = ancestors.slice(0, -1);

  const anchorRef = useRef<HTMLSpanElement>(null);
  const [bounds, setBounds] = useState<{ left: number; width: number }>();

  useEffect(() => {
    const target = anchorRef.current?.closest<HTMLElement>('[data-slot="sidebar-inset"]') ?? null;
    if (!target) return;

    const update = () => {
      const rect = target.getBoundingClientRect();
      setBounds({ left: rect.left, width: rect.width });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    window.addEventListener("resize", update);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      <span ref={anchorRef} className="hidden" aria-hidden />
      <div
        style={{ left: bounds?.left ?? 0, width: bounds?.width ?? "100%" }}
        className={cn(
          "fixed top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md transition-[transform,opacity] duration-300 ease-out",
          visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-full opacity-0",
        )}
      >
        <SidebarTrigger className="-ml-1" />
        <div className="mr-1 h-5 w-px shrink-0 bg-border" />

        <nav className="hidden min-w-0 shrink items-center gap-2 text-xs text-muted-foreground md:flex">
          <Link href="/learnings" className="shrink-0 hover:text-foreground">
            Learnings
          </Link>
          {trail.map((ancestor) => (
            <Fragment key={ancestor.id}>
              <ChevronRightIcon className="size-3 shrink-0" />
              <Link href={`/learnings/${ancestor.id}`} className="max-w-32 truncate hover:text-foreground">
                {ancestor.title}
              </Link>
            </Fragment>
          ))}
          <ChevronRightIcon className="size-3 shrink-0" />
        </nav>

        <span className="min-w-0 flex-1 truncate font-heading text-sm font-semibold tracking-tight">{node.title}</span>

        <span className="ml-3 hidden shrink-0 text-xs text-muted-foreground lg:block">
          Updated {formatDistanceToNow(node.updatedAt, { addSuffix: true })}
        </span>

        <KnowledgePageSearch value={search} onChange={onSearchChange} className="ml-2 w-56 shrink-0" />

        <div
          aria-hidden
          style={{ transform: `scaleX(${progress})` }}
          className="absolute inset-x-0 -bottom-px h-px origin-left bg-linear-to-r from-primary/40 to-primary/80 transition-transform duration-150 ease-out"
        />
      </div>
    </>
  );
};
