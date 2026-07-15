import type { RouteCoverKey } from "@/features/route-cover/lib/routes";

/**
 * Every top-level route that reuses the knowledge (Learnings) UI. Each one is
 * its own independent knowledge base — same spaces/pages/tree/search/cover
 * shape, differing only by this key (and the copy/links derived from it).
 *
 * Kept as a const tuple so it can drive both the server-side Zod validation and
 * the client-side typing/config lookup.
 */
export const KNOWLEDGE_SECTIONS = ["learnings", "career", "projects", "workflows"] as const;

export type KnowledgeSection = (typeof KNOWLEDGE_SECTIONS)[number];

export const isKnowledgeSection = (value: string): value is KnowledgeSection =>
  (KNOWLEDGE_SECTIONS as readonly string[]).includes(value);

/**
 * All the route-specific bits the shared knowledge components need: where links
 * point, what the header/cover say, and which cover image row to load. Threaded
 * through the UI via `KnowledgeSectionProvider` so no component hardcodes a
 * route.
 */
export type KnowledgeSectionConfig = {
  section: KnowledgeSection;
  /** Base path for links, e.g. "/learnings" → `/learnings/[nodeId]`. */
  basePath: string;
  /** Short label used for the breadcrumb/tree root, e.g. "Learnings". */
  label: string;
  /** RouteCover key for the banner image (may differ from the section name). */
  coverRoute: RouteCoverKey;
  cover: { title: string; description: string };
  searchPlaceholder: string;
  /** Empty state shown at the root when no nodes exist yet. */
  emptyRoot: { title: string; description: string };
};

export const KNOWLEDGE_SECTION_CONFIG: Record<KnowledgeSection, KnowledgeSectionConfig> = {
  learnings: {
    section: "learnings",
    basePath: "/learnings",
    label: "Learnings",
    // Existing covers were saved under the legacy "knowledge" key; keep it so
    // they aren't orphaned.
    coverRoute: "knowledge",
    cover: {
      title: "Learnings",
      description: "A place to capture what I've learned.",
    },
    searchPlaceholder: "Search learnings",
    emptyRoot: {
      title: "Start your learnings base",
      description: "Create your first space to begin organizing everything you know.",
    },
  },
  career: {
    section: "career",
    basePath: "/career",
    label: "Career",
    coverRoute: "career",
    cover: {
      title: "Career",
      description: "Track goals, roles, and everything about your career.",
    },
    searchPlaceholder: "Search career",
    emptyRoot: {
      title: "Start your career hub",
      description: "Create your first space to begin organizing everything about your career.",
    },
  },
  projects: {
    section: "projects",
    basePath: "/projects",
    label: "Projects",
    coverRoute: "projects",
    cover: {
      title: "Projects",
      description: "Plan, track, and document your projects.",
    },
    searchPlaceholder: "Search projects",
    emptyRoot: {
      title: "Start your projects hub",
      description: "Create your first space to begin organizing your projects.",
    },
  },
  workflows: {
    section: "workflows",
    basePath: "/workflows",
    label: "AI Workflows",
    coverRoute: "workflows",
    cover: {
      title: "AI Workflows",
      description: "Design and manage your AI workflows.",
    },
    searchPlaceholder: "Search workflows",
    emptyRoot: {
      title: "Start your workflows hub",
      description: "Create your first space to begin organizing your AI workflows.",
    },
  },
};

export const getKnowledgeSectionConfig = (section: KnowledgeSection): KnowledgeSectionConfig =>
  KNOWLEDGE_SECTION_CONFIG[section];
