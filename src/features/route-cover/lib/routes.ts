/**
 * Top-level app routes that can have a Notion-style cover banner. These are the
 * items in the main left sidebar. Kept as a const tuple so it can drive both the
 * server-side Zod validation and the client-side typing.
 */
export const ROUTE_COVER_KEYS = ["dashboard", "knowledge", "career", "projects", "workflows"] as const;

export type RouteCoverKey = (typeof ROUTE_COVER_KEYS)[number];

export const isRouteCoverKey = (value: string): value is RouteCoverKey =>
  (ROUTE_COVER_KEYS as readonly string[]).includes(value);
