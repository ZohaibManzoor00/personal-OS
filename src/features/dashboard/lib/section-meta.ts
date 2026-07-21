import {
  BookIcon,
  BotIcon,
  BriefcaseIcon,
  FileTextIcon,
  FolderOpenIcon,
  type LucideIcon,
} from "lucide-react";
import type { KnowledgeSection } from "@/features/knowledge/lib/sections";

/** Icons mirror the left sidebar so a section reads the same everywhere. */
export const SECTION_ICON: Record<KnowledgeSection, LucideIcon> = {
  learnings: BookIcon,
  career: BriefcaseIcon,
  projects: FolderOpenIcon,
  workflows: BotIcon,
};

export const getSectionIcon = (section: string): LucideIcon =>
  SECTION_ICON[section as KnowledgeSection] ?? FileTextIcon;

/**
 * A distinct, vivid hue per section for the knowledge graph. Kept theme
 * independent (fixed sRGB) so the four clusters stay instantly recognizable in
 * both light and dark mode and across every color theme, where the muted
 * `--chart-*` palette would otherwise blur them together.
 */
export const SECTION_COLOR: Record<KnowledgeSection, string> = {
  learnings: "#3b82f6",
  career: "#f59e0b",
  projects: "#a855f7",
  workflows: "#10b981",
};

export const getSectionColor = (section: string): string =>
  SECTION_COLOR[section as KnowledgeSection] ?? "#94a3b8";
