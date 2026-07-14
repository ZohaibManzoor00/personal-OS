"use client";

import { formatDistanceToNow } from "date-fns";
import { CheckIcon, ImageIcon, Loader2Icon, PencilIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useKnowledgeNode, useUpdateNode } from "../hooks/use-knowledge";
import { KnowledgeImageInsertDialog } from "./knowledge-image-insert-dialog";
import { KnowledgeMarkdown } from "./knowledge-markdown";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";

const AUTOSAVE_DELAY = 800;
const ACCEPTED_TYPES = ["png", "jpeg", "webp", "gif", "avif"];

const isImageFile = (file: File) =>
  ACCEPTED_TYPES.some((type) => file.type === `image/${type}`);

export const KnowledgeEditor = ({
  nodeId,
  onDeleted,
}: {
  nodeId: string;
  onDeleted?: () => void;
}) => {
  const { data: node } = useKnowledgeNode(nodeId);
  const updateNode = useUpdateNode();

  const [isEditing, setIsEditing] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const [content, setContent] = useState(node.body ?? "");
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertPosRef = useRef<number | null>(null);

  // Only pull server content into the editor while viewing, so an in-flight
  // autosave refetch can never clobber characters typed while editing.
  useEffect(() => {
    if (!isEditing) setContent(node.body ?? "");
  }, [node.body, isEditing]);

  const isDirty = content !== (node.body ?? "");

  const handleSave = useCallback(() => {
    if (updateNode.isPending || content === (node.body ?? "")) return;
    updateNode.mutate({ id: node.id, body: content });
  }, [content, node.body, node.id, updateNode]);

  // Debounced autosave — only when the user has opted in.
  useEffect(() => {
    if (!autoSave || !isEditing || !isDirty) return;
    const timeout = setTimeout(handleSave, AUTOSAVE_DELAY);
    return () => clearTimeout(timeout);
  }, [autoSave, content, isEditing, isDirty, handleSave]);

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

  // Queue images for the crop/preview dialog, remembering where to drop the
  // resulting Markdown once each one is committed.
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const images = Array.from(files).filter(isImageFile);
      if (images.length === 0) return;
      insertPosRef.current =
        textareaRef.current?.selectionStart ?? content.length;
      setPendingImages((prev) => [...prev, ...images]);
    },
    [content.length],
  );

  const insertMarkdown = useCallback((markdown: string) => {
    const snippet = `${markdown}\n`;
    setContent((prev) => {
      const pos = insertPosRef.current ?? prev.length;
      insertPosRef.current = pos + snippet.length;
      return prev.slice(0, pos) + snippet + prev.slice(pos);
    });
  }, []);

  const closePendingImage = useCallback(() => {
    setPendingImages((prev) => prev.slice(1));
  }, []);

  const handlePickImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ACCEPTED_TYPES.map((type) => `image/${type}`).join(",");
    input.multiple = true;
    input.onchange = () => {
      if (input.files) handleFiles(input.files);
    };
    input.click();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter(isImageFile);
    if (files.length === 0) return;
    event.preventDefault();
    handleFiles(files);
  };

  const handleDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.dataTransfer.files).filter(isImageFile);
    if (files.length === 0) return;
    event.preventDefault();
    handleFiles(files);
  };

  const enterEdit = () => setIsEditing(true);
  const exitEdit = () => {
    handleSave();
    setIsEditing(false);
  };

  const status = updateNode.isPending
    ? "Saving…"
    : isDirty
      ? "Unsaved changes"
      : "Saved";

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">
            {node.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditing ? (
              <span className="inline-flex items-center gap-1.5">
                {updateNode.isPending && (
                  <Loader2Icon className="size-3 animate-spin" />
                )}
                {status}
              </span>
            ) : (
              <>
                Last updated{" "}
                {formatDistanceToNow(node.updatedAt, { addSuffix: true })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <div className="mr-1 flex items-center gap-2 text-xs text-muted-foreground select-none">
                <Switch
                  size="sm"
                  checked={autoSave}
                  onCheckedChange={setAutoSave}
                  aria-label="Toggle auto-save"
                />
                Auto-save
              </div>
              <Button variant="outline" size="sm" onClick={handlePickImage}>
                <ImageIcon className="size-4" />
                Image
              </Button>
              {!autoSave && isDirty && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  disabled={updateNode.isPending}
                >
                  Save
                </Button>
              )}
              {isDirty ? (
                <Button size="sm" onClick={exitEdit}>
                  <CheckIcon className="size-4" />
                  Done
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={exitEdit}>
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={enterEdit}>
              <PencilIcon className="size-4" />
              Edit
            </Button>
          )}
          <KnowledgeNodeMenu node={node} onDeleted={onDeleted} />
        </div>
      </div>

      {isEditing ? (
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={(event) => event.preventDefault()}
          placeholder="Start writing in Markdown… paste or drop images to embed them."
          className="min-h-[420px] flex-1 resize-none rounded-xl border-border bg-card p-6 font-mono text-sm leading-relaxed shadow-xs focus-visible:ring-0"
        />
      ) : content.trim() ? (
        <KnowledgeMarkdown content={content} className="flex-1" />
      ) : (
        <button
          type="button"
          onClick={enterEdit}
          className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-card/60"
        >
          <PencilIcon className="size-5" />
          <span className="text-sm">This page is empty. Click to start writing.</span>
        </button>
      )}

      <KnowledgeImageInsertDialog
        nodeId={nodeId}
        file={pendingImages[0] ?? null}
        onInsert={insertMarkdown}
        onClose={closePendingImage}
      />
    </div>
  );
};
