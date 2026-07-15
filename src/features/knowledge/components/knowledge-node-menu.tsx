"use client";

import { CornerUpRightIcon, ImageIcon, MoreHorizontalIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { KnowledgeNode } from "../types";
import { KnowledgeDeleteDialog } from "./knowledge-delete-dialog";
import { KnowledgeImageDialog } from "./knowledge-image-dialog";
import { KnowledgeMoveDialog } from "./knowledge-move-dialog";
import { KnowledgeNodeDialog } from "./knowledge-node-dialog";

type Props = {
  node: KnowledgeNode;
  onDeleted?: () => void;
  className?: string;
};

export const KnowledgeNodeMenu = ({ node, onDeleted, className }: Props) => {
  const [renameOpen, setRenameOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={cn("text-muted-foreground", className)}
            aria-label="Actions"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <MoreHorizontalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            <PencilIcon className="size-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
            <CornerUpRightIcon className="size-4" />
            Move to
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setImageOpen(true)}>
            <ImageIcon className="size-4" />
            {node.images.length > 0 ? "Change image" : "Add image"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <TrashIcon className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <KnowledgeNodeDialog mode="rename" node={node} open={renameOpen} onOpenChange={setRenameOpen} />
      <KnowledgeMoveDialog node={node} open={moveOpen} onOpenChange={setMoveOpen} />
      <KnowledgeImageDialog node={node} open={imageOpen} onOpenChange={setImageOpen} />
      <KnowledgeDeleteDialog node={node} open={deleteOpen} onOpenChange={setDeleteOpen} onDeleted={onDeleted} />
    </>
  );
};
