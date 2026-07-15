"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import {
  resolveSectionBasePath,
  resolveSectionLabel,
} from "@/features/knowledge/lib/sections";
import { useDashboardRecentPerSection } from "../hooks/use-dashboard";
import { getSectionIcon } from "../lib/section-meta";
import { RecentNodeCard } from "./recent-node-card";

export const DashboardSections = () => {
  const { data: groups } = useDashboardRecentPerSection();

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const Icon = getSectionIcon(group.section);
        const basePath = resolveSectionBasePath(group.section);

        return (
          <section key={group.section} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Icon className="size-4 text-muted-foreground" />
                {resolveSectionLabel(group.section)}
              </h2>
              <Link
                href={basePath}
                prefetch
                className="flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
                <ChevronRightIcon className="size-3.5" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.nodes.map((node) => (
                <RecentNodeCard key={node.id} node={node} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
