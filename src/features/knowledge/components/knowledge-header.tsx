"use client";

import { FilePlusIcon, FolderPlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";

type Props = {
  title: string;
  description?: string;
  onNewSpace: () => void;
  onNewPage: () => void;
  actions?: ReactNode;
};

export const KnowledgeHeader = ({ title, description, onNewSpace, onNewPage, actions }: Props) => {
  const { isOwner } = useIsOwner();

  return (
    <div className="flex flex-row items-center justify-between gap-x-4">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <h1 className="truncate font-heading text-lg font-semibold md:text-xl">{title}</h1>
          {actions}
        </div>
        {description && <p className="text-xs text-muted-foreground md:text-sm">{description}</p>}
      </div>
      {isOwner && (
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={onNewSpace}>
            <FolderPlusIcon className="size-4" />
            <span className="hidden sm:inline">New space</span>
          </Button>
          <Button size="sm" onClick={onNewPage}>
            <FilePlusIcon className="size-4" />
            <span className="hidden sm:inline">New page</span>
          </Button>
        </div>
      )}
    </div>
  );
};
