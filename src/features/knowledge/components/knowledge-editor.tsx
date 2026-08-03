"use client";

import { formatDistanceToNow } from "date-fns";
import {
  CheckIcon,
  ImageIcon,
  Loader2Icon,
  NetworkIcon,
  PencilIcon,
  SparklesIcon,
  TerminalIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import { useCreateDiagram } from "@/features/diagram/hooks/use-diagram";
import { useKnowledgeNode, usePolishMarkdown, usePreviewHotkeys, useUpdateNode } from "../hooks/use-knowledge";
import { useVimMode } from "../hooks/use-vim-mode";
import { KnowledgeImageInsertDialog } from "./knowledge-image-insert-dialog";
import { KnowledgeMarkdown } from "./knowledge-markdown";
import { KnowledgeNodeMenu } from "./knowledge-node-menu";
import { MarkdownEditor, type MarkdownEditorHandle } from "./markdown-editor";

const AUTOSAVE_DELAY = 800;
const ACCEPTED_TYPES = ["png", "jpeg", "webp", "gif", "avif"];

const isImageFile = (file: File) => ACCEPTED_TYPES.some((type) => file.type === `image/${type}`);

export const KnowledgeEditor = ({
  nodeId,
  onDeleted,
  sentinelRef,
}: {
  nodeId: string;
  onDeleted?: () => void;
  sentinelRef?: React.Ref<HTMLDivElement>;
}) => {
  const { data: node } = useKnowledgeNode(nodeId);
  const { isOwner } = useIsOwner();
  const updateNode = useUpdateNode();
  const polishMarkdown = usePolishMarkdown();
  const createDiagram = useCreateDiagram();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isEditing, setIsEditing] = useState(() => isOwner && searchParams.get("edit") === "1");
  const [autoSave, setAutoSave] = useState(false);
  const [vimMode, setVimMode] = useVimMode();
  const [content, setContent] = useState(node.body ?? "");
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const editorRef = useRef<MarkdownEditorHandle>(null);
  const insertPosRef = useRef<number | null>(null);

  // Drop the `?edit=1` hint from the URL once consumed so a refresh or back/
  // forward navigation doesn't force edit mode again.
  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      router.replace(pathname, { scroll: false });
    }
  }, [searchParams, router, pathname]);

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
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSave();
      } else if (event.key === "Enter" && isEditing) {
        event.preventDefault();
        exitEditRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave, isEditing]);

  // Queue images for the crop/preview dialog, remembering where to drop the
  // resulting Markdown once each one is committed.
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const images = Array.from(files).filter(isImageFile);
      if (images.length === 0) return;
      insertPosRef.current = editorRef.current?.getSelectionHead() ?? content.length;
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

  // Create a blank diagram tied to this page and drop its fenced token at the
  // caret. The owner then draws into it and hits Save on the embed itself.
  const handleInsertDiagram = () => {
    if (createDiagram.isPending) return;
    insertPosRef.current = editorRef.current?.getSelectionHead() ?? content.length;
    createDiagram.mutate(
      { nodeId },
      {
        onSuccess: (diagram) =>
          insertMarkdown(`\n\`\`\`excalidraw\n${diagram.id}\n\`\`\`\n`),
      },
    );
  };

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

  // Ask the AI to rewrite the current text as clean Markdown and swap it in.
  // The replacement is a single CodeMirror edit, so it can be undone (u / ⌘Z).
  const handlePolish = () => {
    if (polishMarkdown.isPending || !content.trim()) return;
    polishMarkdown.mutate({ text: content }, { onSuccess: (result) => setContent(result.markdown) });
  };

  const enterEdit = useCallback(() => {
    if (isOwner) setIsEditing(true);
  }, [isOwner]);
  const exitEdit = () => {
    handleSave();
    setIsEditing(false);
  };
  const exitEditRef = useRef(exitEdit);
  exitEditRef.current = exitEdit;

  usePreviewHotkeys({ enabled: !isEditing && isOwner, onEdit: enterEdit });

  const status = updateNode.isPending ? "Saving…" : isDirty ? "Unsaved changes" : "Saved";

  return (
    <div className="flex h-full flex-col gap-4">
      <div ref={sentinelRef} className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-heading text-2xl font-semibold tracking-tight">{node.title}</h1>
          <p className="text-xs text-muted-foreground">
            {isEditing ? (
              <span className="inline-flex items-center gap-1.5">
                {updateNode.isPending && <Loader2Icon className="size-3 animate-spin" />}
                {status}
              </span>
            ) : (
              <>Last updated {formatDistanceToNow(node.updatedAt, { addSuffix: true })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <div className="mr-1 flex items-center gap-2 text-xs text-muted-foreground select-none">
                <Switch size="sm" checked={autoSave} onCheckedChange={setAutoSave} aria-label="Toggle auto-save" />
                Auto-save
              </div>
              <Toggle
                variant="outline"
                size="sm"
                pressed={vimMode}
                onPressedChange={setVimMode}
                aria-label="Toggle vim mode"
                title="Vim mode"
              >
                <TerminalIcon className="size-4" />
                Vim
              </Toggle>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePolish}
                disabled={polishMarkdown.isPending || !content.trim()}
                title="Reformat as clean Markdown with AI"
              >
                {polishMarkdown.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <SparklesIcon className="size-4" />}
                Format
              </Button>
              <Button variant="outline" size="sm" onClick={handlePickImage}>
                <ImageIcon className="size-4" />
                Image
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleInsertDiagram}
                disabled={createDiagram.isPending}
                title="Insert an embedded Excalidraw diagram"
              >
                {createDiagram.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <NetworkIcon className="size-4" />
                )}
                Diagram
              </Button>
              {!autoSave && isDirty && (
                <Button variant="outline" size="sm" onClick={handleSave} disabled={updateNode.isPending}>
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
          ) : isOwner ? (
            <Button variant="outline" size="sm" onClick={enterEdit}>
              <PencilIcon className="size-4" />
              Edit
            </Button>
          ) : null}
          <KnowledgeNodeMenu node={node} onDeleted={onDeleted} />
        </div>
      </div>

      {isEditing ? (
        <MarkdownEditor
          ref={editorRef}
          value={content}
          onChange={setContent}
          vimMode={vimMode}
          autoFocus
          isImageFile={isImageFile}
          onImageFiles={handleFiles}
          placeholder="Start writing in Markdown… paste or drop images to embed them."
          className="min-h-[420px] flex-1 rounded-xl border border-border bg-card shadow-xs"
        />
      ) : content.trim() ? (
        <KnowledgeMarkdown content={content} className="flex-1" />
      ) : isOwner ? (
        <button
          type="button"
          onClick={enterEdit}
          className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/40 text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-card/60"
        >
          <PencilIcon className="size-5" />
          <span className="text-sm">This page is empty. Click to start writing.</span>
        </button>
      ) : (
        <div className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/40 text-muted-foreground">
          <span className="text-sm">This page is empty.</span>
        </div>
      )}

      <KnowledgeImageInsertDialog nodeId={nodeId} file={pendingImages[0] ?? null} onInsert={insertMarkdown} onClose={closePendingImage} />
    </div>
  );
};
