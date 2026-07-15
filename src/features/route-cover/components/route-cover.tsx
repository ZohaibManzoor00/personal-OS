"use client";

import { ImagePlusIcon, Loader2Icon, PencilIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import { cn } from "@/lib/utils";
import { useRouteCover } from "../hooks/use-route-cover";
import type { RouteCoverKey } from "../lib/routes";
import { RouteCoverDialog } from "./route-cover-dialog";

type Props = {
  route: RouteCoverKey;
  title?: string;
  description?: string;
  /** Right-aligned controls shown next to the title (e.g. "New page"). */
  actions?: React.ReactNode;
  /** Extra content overlaid on the cover, below the title (e.g. recent items). */
  children?: React.ReactNode;
  className?: string;
};

/**
 * Notion-style cover banner for a whole route. Renders a full-bleed image behind
 * the page's top block (title → description → children), fading into the page
 * background so overlaid content stays legible. Hovering the top-right reveals
 * controls to change or remove the cover.
 */
export const RouteCover = ({ route, title, description, actions, children, className }: Props) => {
  const { cover, upload, applyDefault, remove, isUploading, isRemoving } = useRouteCover(route);
  const { isOwner } = useIsOwner();
  const [dialogOpen, setDialogOpen] = useState(false);

  const isBusy = isUploading || isRemoving;
  const hasCover = Boolean(cover);

  return (
    <div
      className={cn(
        // Full width of the main content area; the inner content stays aligned
        // with the centered page column below. Title/actions sit at the top so
        // they render immediately and never shift as async content loads in.
        "group/cover relative flex min-h-[340px] w-full flex-col overflow-hidden",
        className,
      )}
    >
      {/* Cover image or a branded placeholder gradient when unset. */}
      {cover ? (
        // biome-ignore lint/performance/noImgElement: R2 public asset, no next/image domain config
        <img src={cover.url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-linear-to-br from-primary/25 via-muted to-accent" />
      )}

      {/* Scrim: keep a legible backdrop behind the top-aligned title while still
          letting the image show through. */}
      <div className="absolute inset-0 bg-background/25" />
      {/* Subtle bottom fade so the cover blends softly into the page below.
          Multi-stop eased gradient avoids the visible banding line a plain
          two-stop fade produces. */}
      <div className="absolute inset-x-0 bottom-0 h-2 bg-[linear-gradient(to_top,var(--background)_0%,color-mix(in_oklab,var(--background)_75%,transparent)_25%,color-mix(in_oklab,var(--background)_40%,transparent)_50%,color-mix(in_oklab,var(--background)_15%,transparent)_72%,transparent_100%)]" />

      {/* Hover controls, pinned to the top-right of the centered content column
          so they sit in the strip above the title/actions row. Owner only. */}
      {isOwner && (
      <div className="pointer-events-none absolute inset-x-0 top-3 z-20 px-4 md:px-10">
        <div className="pointer-events-auto mx-auto flex max-w-7xl justify-end gap-1.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/cover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isBusy}
            onClick={() => setDialogOpen(true)}
            className="bg-background/70 backdrop-blur-sm"
          >
            {isUploading ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : hasCover ? (
              <PencilIcon className="size-4" />
            ) : (
              <ImagePlusIcon className="size-4" />
            )}
            {hasCover ? "Change cover" : "Add cover"}
          </Button>
          {hasCover && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isBusy}
              onClick={() => remove()}
              className="bg-background/70 backdrop-blur-sm"
              aria-label="Remove cover"
            >
              {isRemoving ? <Loader2Icon className="size-4 animate-spin" /> : <Trash2Icon className="size-4" />}
            </Button>
          )}
        </div>
      </div>
      )}

      {/* Overlaid content, aligned to the centered page column. The top padding
          leaves room for the hover controls strip so nothing overlaps. */}
      <div className="relative z-10 px-4 pt-8 pb-16 md:px-10 md:pb-24">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          {(title || actions) && (
            <div className="flex flex-row items-end justify-between gap-x-4">
              <div className="flex min-w-0 flex-col">
                {title && <h1 className="truncate font-heading text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>}
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
                {/* {description && <></>} */}
              </div>
              {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
            </div>
          )}
          {children}
        </div>
      </div>

      <RouteCoverDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        hasCover={hasCover}
        isBusy={isBusy}
        onUpload={upload}
        onApplyDefault={applyDefault}
        onRemove={remove}
      />
    </div>
  );
};
