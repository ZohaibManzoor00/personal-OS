"use client";

import {
  FilePenLineIcon,
  FileTextIcon,
  FolderIcon,
  PlusIcon,
  TypeIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useDashboardStats } from "../hooks/use-dashboard";
import type { DashboardStats as DashboardStatsType } from "../types";

const buildStats = (stats: DashboardStatsType) => [
  { label: "Pages", value: stats.pages, icon: FileTextIcon },
  { label: "Spaces", value: stats.spaces, icon: FolderIcon },
  { label: "Added this week", value: stats.addedThisWeek, icon: PlusIcon },
  {
    label: "Edited this week",
    value: stats.editedThisWeek,
    icon: FilePenLineIcon,
  },
  { label: "Words written", value: stats.words, icon: TypeIcon },
];

export const DashboardStats = () => {
  const { data } = useDashboardStats();
  const stats = buildStats(data);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label} size="sm" className="gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            <Icon className="size-4 text-muted-foreground" />
          </div>
          <span className="text-2xl font-semibold tabular-nums">
            {value.toLocaleString()}
          </span>
        </Card>
      ))}
    </div>
  );
};
