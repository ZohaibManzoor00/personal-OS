"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookIcon,
  BotIcon,
  BriefcaseIcon,
  FilePlusIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  HomeIcon,
  Loader2Icon,
  PanelLeftIcon,
  PencilRulerIcon,
  SparklesIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import { Highlighted, ResultBreadcrumbTitle } from "@/features/knowledge/components/knowledge-highlight";
import { useCreateNode } from "@/features/knowledge/hooks/use-knowledge";
import { groupSearchResultsBySection } from "@/features/knowledge/lib/group-results";
import { buildNodeHref } from "@/features/knowledge/lib/search-navigation";
import {
  getKnowledgeSectionConfig,
  isKnowledgeSection,
  isSectionLocked,
  type KnowledgeSection,
  resolveSectionLabel,
} from "@/features/knowledge/lib/sections";
import { useTRPC } from "@/trpc/client";
import { useCommandPalette, useCommandPaletteHotkey } from "../use-command-palette";
import { AskAiView } from "./ask-ai";

type NavItem = { label: string; href: string; icon: typeof HomeIcon };

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: HomeIcon },
  { label: "Learnings", href: "/learnings", icon: BookIcon },
  { label: "Career", href: "/career", icon: BriefcaseIcon },
  { label: "Projects", href: "/projects", icon: FolderOpenIcon },
  { label: "AI Workflows", href: "/workflows", icon: BotIcon },
  { label: "AI Chat", href: "/chat", icon: SparklesIcon },
  { label: "Draw", href: "/draw", icon: PencilRulerIcon },
];

/** First path segment mapped to a knowledge section, if we're inside a hub. */
const sectionFromPathname = (pathname: string): KnowledgeSection | null => {
  const segment = pathname.split("/").filter(Boolean).at(0);
  return segment && isKnowledgeSection(segment) ? segment : null;
};

/**
 * Translate Tab / Shift+Tab into cmdk's own down/up navigation so the arrow
 * keys and Tab both move the selection. We re-dispatch a bubbling Arrow key
 * event from the input, which cmdk's root handler picks up.
 */
const handleTabNavigation = (event: React.KeyboardEvent<HTMLInputElement>) => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  event.currentTarget.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: event.shiftKey ? "ArrowUp" : "ArrowDown",
      bubbles: true,
    }),
  );
};

/** Icon in a rounded chip that inverts on the selected row for contrast. */
const ItemIcon = ({ icon: Icon }: { icon: typeof HomeIcon }) => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-transparent transition-colors group-data-[selected=true]/command-item:bg-background group-data-[selected=true]/command-item:text-foreground group-data-[selected=true]/command-item:ring-border">
    <Icon className="size-4" />
  </span>
);

/** Muted pill showing which hub a result/recent belongs to. */
const SectionBadge = ({ section }: { section: string }) => (
  <span className="ml-auto shrink-0 self-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
    {resolveSectionLabel(section)}
  </span>
);

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground">
    {children}
  </kbd>
);

/**
 * The global ⌘K palette: one search-and-navigate surface for the whole app.
 * Empty query shows recents + quick actions + navigation; typing runs the
 * server search (grouped by hub, current section boosted) and offers quick
 * create. Mounted once in the app shell.
 */
export const CommandPalette = () => {
  const { open, setOpen } = useCommandPalette();
  useCommandPaletteHotkey();

  const router = useRouter();
  const pathname = usePathname();
  const trpc = useTRPC();
  const { isOwner } = useIsOwner();
  const { toggleSidebar } = useSidebar();
  const createNode = useCreateNode();

  const currentSection = sectionFromPathname(pathname);

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  // When set, the palette shows the streaming AI answer for this question
  // instead of the search list.
  const [ask, setAsk] = useState<string | null>(null);

  // Debounce typing before hitting the search endpoint.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), 200);
    return () => clearTimeout(timer);
  }, [input]);

  // Clear the query whenever the palette closes so it reopens fresh.
  useEffect(() => {
    if (!open) {
      setInput("");
      setQuery("");
      setAsk(null);
    }
  }, [open]);

  // Focus the search input whenever the search view is showing (on open, and
  // when returning from an AI answer), since a content swap doesn't refocus.
  useEffect(() => {
    if (!open || ask !== null) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('[data-slot="command-input"]')?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open, ask]);

  // Leave the AI answer, clearing the query so the search box is empty and
  // focused again.
  const backToSearch = () => {
    setAsk(null);
    setInput("");
    setQuery("");
  };

  const hasQuery = query.length > 0;

  const { data: results, isFetching: isSearching } = useQuery(
    trpc.knowledge.search.queryOptions({ query, ...(currentSection ? { section: currentSection } : {}) }, { enabled: open && hasQuery }),
  );

  const { data: recents } = useQuery(trpc.dashboard.recentAll.queryOptions({ limit: 8 }, { enabled: open && !hasQuery }));

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const goToNode = (section: string, id: string, type: "SPACE" | "PAGE") =>
    run(() => router.push(buildNodeHref(section, id, type === "PAGE" ? query : undefined)));

  const quickCreate = (type: "SPACE" | "PAGE") => {
    const section: KnowledgeSection = currentSection ?? "learnings";
    const title = query || "Untitled";
    run(() =>
      createNode.mutate(
        { section, parentId: null, type, title },
        {
          onSuccess: (node) => {
            const base = getKnowledgeSectionConfig(section).basePath;
            router.push(node.type === "PAGE" ? `${base}/${node.id}?edit=1` : `${base}/${node.id}`);
          },
        },
      ),
    );
  };

  const navItems = NAV_ITEMS.filter((item) => {
    const section = sectionFromPathname(item.href);
    // Hide locked hubs (e.g. Workflows) from non-owners.
    if (section && isSectionLocked(section) && !isOwner) return false;
    if (!hasQuery) return true;
    return item.label.toLowerCase().includes(query.toLowerCase());
  });

  const groups = results ? groupSearchResultsBySection(results, currentSection ?? "") : [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search, navigate, and create"
      className="top-[8%] max-h-[84vh] overflow-hidden p-0 sm:max-w-2xl"
    >
      {ask !== null ? (
        <AskAiView question={ask} onBack={backToSearch} />
      ) : (
        <Command shouldFilter={false} loop className="rounded-none bg-transparent p-0">
          <CommandInput
            value={input}
            onValueChange={setInput}
            onKeyDown={handleTabNavigation}
            placeholder="Search everything or jump to…"
          />
          <CommandList className="mt-1 max-h-[60vh] border-t p-1.5">
            {hasQuery && isSearching && !results ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Searching…
              </div>
            ) : null}

            {!hasQuery && recents && recents.length > 0 ? (
              <CommandGroup heading="Recent">
                {recents.map((node) => {
                  const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
                  return (
                    <CommandItem
                      key={node.id}
                      value={`recent-${node.id}`}
                      onSelect={() => goToNode(node.section, node.id, node.type)}
                      className="gap-3 rounded-lg px-2 py-2"
                    >
                      <ItemIcon icon={Icon} />
                      <span className="min-w-0 flex-1 truncate">{node.title}</span>
                      <SectionBadge section={node.section} />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ) : null}

            {hasQuery
              ? groups.map((group) => (
                  <CommandGroup key={group.section} heading={group.label}>
                    {group.results.map((node) => {
                      const Icon = node.type === "SPACE" ? FolderIcon : FileTextIcon;
                      return (
                        <CommandItem
                          key={node.id}
                          value={`result-${node.id}`}
                          onSelect={() => goToNode(node.section, node.id, node.type)}
                          className="items-start gap-3 rounded-lg px-2 py-2"
                        >
                          <ItemIcon icon={Icon} />
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <ResultBreadcrumbTitle breadcrumb={node.breadcrumb} titleHighlight={node.titleHighlight} />
                            {node.snippet ? (
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                <Highlighted value={node.snippet} />
                              </p>
                            ) : null}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ))
              : null}

            {hasQuery ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Ask">
                  <CommandItem value="ask-ai" onSelect={() => setAsk(query)} className="gap-3 rounded-lg px-2 py-2">
                    <ItemIcon icon={SparklesIcon} />
                    <span className="min-w-0 flex-1 truncate">Ask AI: "{query}"</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}

            {isOwner ? (
              <>
                <CommandSeparator />
                <CommandGroup heading={hasQuery ? "Create" : "Quick actions"}>
                  <CommandItem value="create-page" onSelect={() => quickCreate("PAGE")} className="gap-3 rounded-lg px-2 py-2">
                    <ItemIcon icon={FilePlusIcon} />
                    <span>
                      {hasQuery ? `Create page "${query}"` : "New page"}
                      {!hasQuery && currentSection ? (
                        <span className="ml-1 text-xs text-muted-foreground">in {resolveSectionLabel(currentSection)}</span>
                      ) : null}
                    </span>
                  </CommandItem>
                  <CommandItem value="create-space" onSelect={() => quickCreate("SPACE")} className="gap-3 rounded-lg px-2 py-2">
                    <ItemIcon icon={FolderPlusIcon} />
                    <span>{hasQuery ? `Create space "${query}"` : "New space"}</span>
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}

            {navItems.length > 0 ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  {navItems.map((item) => {
                    const active = pathname.startsWith(item.href);
                    return (
                      <CommandItem
                        key={item.href}
                        value={`nav-${item.href}`}
                        onSelect={() => run(() => router.push(item.href))}
                        className="gap-3 rounded-lg px-2 py-2"
                      >
                        <ItemIcon icon={item.icon} />
                        <span className="flex-1">{item.label}</span>
                        {active ? <span className="text-xs text-muted-foreground">current</span> : null}
                      </CommandItem>
                    );
                  })}
                  {!hasQuery || "toggle sidebar".includes(query.toLowerCase()) ? (
                    <CommandItem value="toggle-sidebar" onSelect={() => run(toggleSidebar)} className="gap-3 rounded-lg px-2 py-2">
                      <ItemIcon icon={PanelLeftIcon} />
                      <span>Toggle sidebar</span>
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>

          <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                <span className="mx-0.5">or</span>
                <Kbd>Tab</Kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd>
                open
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd>
              close
            </span>
          </div>
        </Command>
      )}
    </CommandDialog>
  );
};
