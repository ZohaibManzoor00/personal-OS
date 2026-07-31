"use client";

import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Card } from "@/components/ui/card";
import { DashboardRecent } from "./dashboard-recent";
import { DashboardRecents } from "./dashboard-recents";
import { DashboardStats } from "./dashboard-stats";

const STAT_SKELETON_KEYS = ["pages", "spaces", "added", "edited", "words"];

const StatsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
    {STAT_SKELETON_KEYS.map((key) => (
      <Card
        key={key}
        size="sm"
        className="h-[86px] animate-pulse bg-muted/40 p-4"
      />
    ))}
  </div>
);

/**
 * Stats + "jump back in" recents, overlaid inside the dashboard cover banner.
 * Stays visible while searching — only the card list below the cover swaps to
 * results.
 */
export const DashboardCoverContent = () => {
  return (
    <div className="flex flex-col gap-4">
      <ErrorBoundary fallback={null}>
        <Suspense fallback={<StatsSkeleton />}>
          <DashboardStats />
        </Suspense>
      </ErrorBoundary>

      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <DashboardRecent />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

/** Per-section recents carousels, rendered below the cover in the main column. */
export const DashboardSectionsPanel = () => (
  <ErrorBoundary fallback={null}>
    <Suspense fallback={null}>
      <DashboardRecents />
    </Suspense>
  </ErrorBoundary>
);
