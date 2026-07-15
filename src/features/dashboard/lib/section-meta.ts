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
