"use client";

import { useDashboardRecentPerSection } from "../hooks/use-dashboard";
import { DashboardSectionCard } from "./dashboard-section-card";

export const DashboardSections = () => {
  const { data: groups } = useDashboardRecentPerSection();

  if (groups.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <DashboardSectionCard key={group.section} group={group} />
      ))}
    </div>
  );
};
