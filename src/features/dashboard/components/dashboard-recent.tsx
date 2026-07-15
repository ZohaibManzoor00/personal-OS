"use client";

import { useDashboardRecentAll } from "../hooks/use-dashboard";
import { RecentNodeCard } from "./recent-node-card";

export const DashboardRecent = () => {
  const { data: nodes } = useDashboardRecentAll();

  if (nodes.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Jump back in
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nodes.map((node) => (
          <RecentNodeCard key={node.id} node={node} showSection />
        ))}
      </div>
    </section>
  );
};
