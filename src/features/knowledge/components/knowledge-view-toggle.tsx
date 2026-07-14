"use client";

import { LayoutGridIcon, ListTreeIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type KnowledgeView, useKnowledgeView } from "../hooks/use-knowledge";

export const KnowledgeViewToggle = () => {
  const [view, setView] = useKnowledgeView();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={view}
      onValueChange={(next) => {
        if (next) setView(next as KnowledgeView);
      }}
    >
      <ToggleGroupItem value="cards" aria-label="Card view">
        <LayoutGridIcon className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="tree" aria-label="Tree view">
        <ListTreeIcon className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
