"use client";

import { FilePlusIcon, FolderPlusIcon, LibraryIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

type Props = {
  title: string;
  description: string;
  onNewSpace: () => void;
  onNewPage: () => void;
};

export const KnowledgeEmptyState = ({
  title,
  description,
  onNewSpace,
  onNewPage,
}: Props) => {
  return (
    <Empty className="border border-dashed bg-card/40">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LibraryIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={onNewSpace}>
            <FolderPlusIcon className="size-4" />
            New space
          </Button>
          <Button onClick={onNewPage}>
            <FilePlusIcon className="size-4" />
            New page
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
};
