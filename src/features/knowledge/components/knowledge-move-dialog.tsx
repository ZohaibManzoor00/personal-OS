"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Node as KnowledgeNode } from "@/generated/prisma/client";
import { useMoveNode, useSpaces } from "../hooks/use-knowledge";

const ROOT_VALUE = "__root__";

type Props = {
  node: KnowledgeNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const KnowledgeMoveDialog = ({ node, open, onOpenChange }: Props) => {
  const { data: spaces, isLoading } = useSpaces(open);
  const moveNode = useMoveNode();

  const [value, setValue] = useState<string>(node.parentId ?? ROOT_VALUE);

  const excludedIds = useMemo(() => {
    const excluded = new Set<string>([node.id]);
    const list = spaces ?? [];

    let changed = true;
    while (changed) {
      changed = false;
      for (const space of list) {
        if (
          !excluded.has(space.id) &&
          space.parentId &&
          excluded.has(space.parentId)
        ) {
          excluded.add(space.id);
          changed = true;
        }
      }
    }

    return excluded;
  }, [spaces, node.id]);

  const options = useMemo(
    () => (spaces ?? []).filter((space) => !excludedIds.has(space.id)),
    [spaces, excludedIds],
  );

  const handleMove = () => {
    moveNode.mutate(
      { id: node.id, parentId: value === ROOT_VALUE ? null : value },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move "{node.title}"</DialogTitle>
          <DialogDescription>
            Choose a destination space, or move it to the top level.
          </DialogDescription>
        </DialogHeader>
        <Select value={value} onValueChange={setValue} disabled={isLoading}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ROOT_VALUE}>Top level</SelectItem>
            {options.map((space) => (
              <SelectItem key={space.id} value={space.id}>
                {space.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={moveNode.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleMove}
            disabled={moveNode.isPending}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
