"use client";

import { indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { vim } from "@replit/codemirror-vim";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

export interface MarkdownEditorHandle {
  /** Caret position (head of the primary selection) in the document. */
  getSelectionHead: () => number;
  focus: () => void;
}

// Two-space indentation, matching the previous textarea behaviour.
const INDENT = "  ";

// Colours are driven by the app's CSS custom properties so the editor tracks
// light/dark themes automatically without knowing the active theme.
const editorTheme = EditorView.theme({
  "&": {
    color: "var(--foreground)",
    backgroundColor: "transparent",
    fontSize: "0.875rem",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.625",
    padding: "1.5rem",
    caretColor: "var(--foreground)",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    overflow: "auto",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "color-mix(in oklab, var(--primary) 18%, transparent)",
  },
  ".cm-placeholder": {
    color: "var(--muted-foreground)",
  },
  // Vim's block ("fat") cursor.
  ".cm-fat-cursor": {
    backgroundColor: "color-mix(in oklab, var(--primary) 45%, transparent)",
    color: "var(--foreground)",
  },
  "&:not(.cm-focused) .cm-fat-cursor": {
    background: "none",
    outline: "1px solid color-mix(in oklab, var(--primary) 45%, transparent)",
  },
  // Vim status/command bar rendered at the bottom of the editor.
  ".cm-vim-panel": {
    fontFamily: "var(--font-mono)",
    fontSize: "0.75rem",
    padding: "0.25rem 0.5rem",
    color: "var(--muted-foreground)",
    backgroundColor: "var(--muted)",
  },
  ".cm-vim-panel input": {
    fontFamily: "var(--font-mono)",
    color: "var(--foreground)",
  },
});

const imageFilesFrom = (list: FileList | null | undefined, isImageFile: (file: File) => boolean): File[] =>
  list ? Array.from(list).filter(isImageFile) : [];

export const MarkdownEditor = forwardRef<
  MarkdownEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    vimMode?: boolean;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    isImageFile?: (file: File) => boolean;
    onImageFiles?: (files: File[]) => void;
  }
>(function MarkdownEditor(
  { value, onChange, vimMode = false, placeholder: placeholderText, className, autoFocus, isImageFile, onImageFiles },
  ref,
) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  useImperativeHandle(ref, () => ({
    getSelectionHead: () => cmRef.current?.view?.state.selection.main.head ?? value.length,
    focus: () => cmRef.current?.view?.focus(),
  }));

  const extensions = useMemo(() => {
    const dropImages = (list: FileList | null | undefined) => {
      if (!isImageFile || !onImageFiles) return false;
      const files = imageFilesFrom(list, isImageFile);
      if (files.length === 0) return false;
      onImageFiles(files);
      return true;
    };

    return [
      // Vim must load first so its keymap takes precedence over the defaults.
      ...(vimMode ? [vim({ status: true })] : []),
      markdown(),
      EditorView.lineWrapping,
      indentUnit.of(INDENT),
      keymap.of([indentWithTab]),
      ...(placeholderText ? [placeholder(placeholderText)] : []),
      EditorView.domEventHandlers({
        paste: (event) => dropImages(event.clipboardData?.files),
        drop: (event) => dropImages(event.dataTransfer?.files),
      }),
      editorTheme,
    ];
  }, [vimMode, placeholderText, isImageFile, onImageFiles]);

  return (
    <CodeMirror
      ref={cmRef}
      value={value}
      onChange={onChange}
      extensions={extensions}
      autoFocus={autoFocus}
      theme="none"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        autocompletion: false,
      }}
      className={cn("h-full w-full overflow-hidden", className)}
      height="100%"
    />
  );
});
