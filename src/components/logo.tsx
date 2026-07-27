"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

/**
 * Theme-aware brand mark. All fills reference the active theme's CSS variables
 * (`--sidebar-primary`, `--chart-*`, `--primary-foreground`), which are swapped
 * per color theme *and* per light/dark mode on `document.body`, so the logo
 * recolors automatically everywhere with no per-theme assets.
 *
 * Idle: a subtle "breathe". Hover: a sheen shimmers across the facets. Both are
 * gated behind `motion-safe:` to respect `prefers-reduced-motion`.
 */
type LogoProps = {
  size?: number;
  className?: string;
};

export function Logo({ size = 30, className }: LogoProps) {
  const id = useId();
  const left = `${id}-left`;
  const right = `${id}-right`;
  const clip = `${id}-clip`;
  const sheen = `${id}-sheen`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Zo's OS logo"
      className={cn("group/logo motion-safe:animate-logo-breathe", className)}
    >
      <defs>
        <linearGradient id={left} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--sidebar-primary)" />
          <stop offset="100%" stopColor="var(--chart-2)" />
        </linearGradient>
        <linearGradient id={right} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" />
          <stop offset="100%" stopColor="var(--chart-3)" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--primary-foreground)" stopOpacity="0" />
          <stop offset="50%" stopColor="var(--primary-foreground)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--primary-foreground)" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clip}>
          <path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" />
          <path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" />
          <path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" />
          <path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" />
        </clipPath>
      </defs>
      <path d="m0 14.5264v18.9473l17.8947-12.2437v-18.94741z" fill={`url(#${left})`} />
      <path d="m0 33.4737v-18.9474l17.8947 12.2438v18.9474z" fill={`url(#${left})`} opacity=".7" />
      <path d="m40 14.5263v18.9474l-17.8947-12.2438v-18.94737z" fill={`url(#${right})`} />
      <path d="m40 33.4737v-18.9474l-17.8947 12.2438v18.9474z" fill={`url(#${right})`} opacity=".7" />
      {/* Hover shimmer: a light sheen clipped to the mark, parked off-screen
          until the logo is hovered. */}
      <g clipPath={`url(#${clip})`}>
        <rect
          x="0"
          y="0"
          width="16"
          height="48"
          fill={`url(#${sheen})`}
          className="translate-x-[-250%] motion-safe:group-hover/logo:animate-logo-shimmer"
        />
      </g>
    </svg>
  );
}
