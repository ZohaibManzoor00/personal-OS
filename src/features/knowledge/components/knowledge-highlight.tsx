"use client";

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { parseHighlights } from "../lib/search-highlight";

export const Highlighted = ({ value }: { value: string }) => (
  <>
    {parseHighlights(value).map((segment) =>
      segment.match ? (
        <mark key={segment.start} className="rounded-[3px] bg-primary/20 px-0.5 font-medium text-foreground">
          {segment.text}
        </mark>
      ) : (
        <Fragment key={segment.start}>{segment.text}</Fragment>
      ),
    )}
  </>
);

/**
 * Renders a search hit's location as `breadcrumb / … / Title`, where the
 * ancestor trail is muted and truncates first (so the bold title stays visible)
 * and the title itself is bold and highlighted.
 */
export const ResultBreadcrumbTitle = ({
  breadcrumb,
  titleHighlight,
  className,
}: {
  breadcrumb: { id: string; title: string }[];
  titleHighlight: string;
  className?: string;
}) => (
  <span className={cn("flex min-w-0 items-baseline text-sm", className)}>
    {breadcrumb.length > 0 ? (
      <span className="min-w-0 shrink truncate text-muted-foreground">
        {breadcrumb.map((crumb) => (
          <span key={crumb.id}>
            {crumb.title}
            <span className="mx-1 text-muted-foreground/50">/</span>
          </span>
        ))}
      </span>
    ) : null}
    <span className="shrink-0 truncate font-semibold text-foreground">
      <Highlighted value={titleHighlight} />
    </span>
  </span>
);
