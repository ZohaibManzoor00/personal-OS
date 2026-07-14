"use client";

import { formatDistanceToNow } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Node as KnowledgeNode } from "@/generated/prisma/client";
import { useKnowledgeNode, useUpdateNode } from "../hooks/use-knowledge";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";

export const KnowledgeEditor = ({
  nodeId,
  onDeleted,
}: {
  nodeId: string;
  onDeleted?: () => void;
}) => {
  const { data: node } = useKnowledgeNode(nodeId);
  const updateNode = useUpdateNode();

  const [content, setContent] = useState(node.body ?? "");

  useEffect(() => {
    setContent(node.body ?? "");
  }, [node.body]);

  const isDirty = content !== (node.body ?? "");

  const handleSave = useCallback(() => {
    if (!isDirty || updateNode.isPending) return;
    updateNode.mutate({ id: node.id, body: content });
  }, [content, isDirty, node.id, updateNode]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
            {node.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Last updated{" "}
            {formatDistanceToNow(node.updatedAt, { addSuffix: true })}
          </p>
        </div>
        <KnowledgeNodeMenu node={node as KnowledgeNode} onDeleted={onDeleted} />
      </div>

      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Start writing in Markdown..."
        className="min-h-[420px] flex-1 resize-none rounded-xl border-border bg-card p-6 font-mono text-sm leading-relaxed shadow-xs focus-visible:ring-0"
      />

      <div className="flex items-center justify-end gap-3">
        {isDirty && (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        )}
        <Button
          onClick={handleSave}
          disabled={!isDirty || updateNode.isPending}
        >
          {updateNode.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};
