"use client";

import {
  convertToExcalidrawElements,
  Excalidraw,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { type ComponentProps, useEffect, useState } from "react";

// The imperative API handle Excalidraw hands back, derived from the prop so we
// don't depend on a deep type import path.
type ExcalidrawApi = Parameters<
  NonNullable<ComponentProps<typeof Excalidraw>["excalidrawAPI"]>
>[0];

/**
 * Renders a Mermaid string as an interactive Excalidraw scene. Client-only: this
 * module is imported via `next/dynamic` with `ssr: false`, so Excalidraw's
 * browser-only code never runs on the server.
 *
 * Order matters for legibility: the Excalidraw component mounts first (which
 * kicks off loading its hand-drawn font), then we wait for `document.fonts.ready`
 * before converting. Measuring text widths before the font loads is what clips
 * the first/last letter of each label — the width is computed with a fallback
 * font but drawn with the wider real one. A common LLM slip (double quotes in
 * labels) is auto-fixed with a single-quote retry, mirroring Excalidraw itself.
 */
export default function ExcalidrawCanvas({ mermaid }: { mermaid: string }) {
  const [api, setApi] = useState<ExcalidrawApi | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    const build = async (syntax: string) => {
      const { elements: skeleton } = await parseMermaidToExcalidraw(syntax, {
        themeVariables: { fontSize: "16px" },
      });
      return convertToExcalidrawElements(skeleton);
    };

    const run = async () => {
      try {
        // Fonts must be loaded before we measure text, or labels clip.
        await document.fonts.ready;
        const elements = await build(mermaid).catch((error) => {
          if (mermaid.includes('"')) return build(mermaid.replaceAll('"', "'"));
          throw error;
        });
        if (cancelled) return;
        if (elements.length === 0) {
          setFailed(true);
          return;
        }
        api.updateScene({ elements });
        api.scrollToContent(elements, { fitToContent: true, animate: false });
        setReady(true);
      } catch (error) {
        console.error("mermaid → excalidraw conversion failed", error);
        if (!cancelled) setFailed(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [api, mermaid]);

  return (
    <div className="relative size-full">
      <Excalidraw
        excalidrawAPI={setApi}
        initialData={{ appState: { viewBackgroundColor: "transparent" } }}
      />
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background px-3 text-center text-xs text-muted-foreground">
          Couldn't render this diagram.
        </div>
      ) : (
        !ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-background text-xs text-muted-foreground">
            Rendering diagram…
          </div>
        )
      )}
    </div>
  );
}
