"use client";

import { BookIcon, BotIcon, BriefcaseIcon, FolderOpenIcon, HomeIcon, LockIcon, LogInIcon, LogOutIcon, SparklesIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeSettings } from "@/components/theme-settings";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useIsOwner } from "@/features/auth/hooks/use-is-owner";
import { isSectionLocked, type KnowledgeSection } from "@/features/knowledge/lib/sections";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
// import { useHasActiveSubscription } from "@/features/subscriptions/hooks/use-subscription";

export const AppSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { isOwner, isAuthenticated } = useIsOwner();
  // const { hasActiveSubscription, isLoading } = useHasActiveSubscription();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="gap-x-4 h-10 px-4">
            <Link href="/" prefetch>
              <Image src="/logos/logo.svg" alt="Zeno" width={30} height={30} />
              <span className="font-semibold text-sm">Zo's OS</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const locked = item.section ? isSectionLocked(item.section) : false;
                  // Locked (personal) sections are unavailable to non-owners: shown
                  // with a lock and no link. The owner still gets a working link.
                  const unavailable = locked && !isOwner;
                  const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
                  // Lucide icons are stroke-only outlines; on the active route we
                  // add a soft, theme-aware fill so the icon reads as its "filled"
                  // counterpart without hardcoding a color.
                  const iconClassName = cn(
                    "size-4 transition-colors [&_*]:transition-[fill]",
                    isActive && "fill-sidebar-primary/25 text-sidebar-primary",
                  );

                  return (
                    <SidebarMenuItem key={item.title}>
                      {unavailable ? (
                        <SidebarMenuButton
                          tooltip={`${item.title} (locked)`}
                          className="gap-x-4 h-10 px-4 cursor-not-allowed opacity-60"
                          aria-disabled
                          onClick={(event) => event.preventDefault()}
                        >
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                          <LockIcon className="ml-auto size-3.5 text-muted-foreground" />
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isActive}
                          asChild
                          className="gap-x-4 h-10 px-4"
                        >
                          <Link href={item.url} prefetch>
                            <item.icon className={iconClassName} />
                            <span>{item.title}</span>
                            {locked && <LockIcon className="ml-auto size-3.5 text-muted-foreground" />}
                          </Link>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeSettings />
          </SidebarMenuItem>
          <SidebarMenuItem>
            {isAuthenticated ? (
              <SidebarMenuButton
                tooltip="Sign out"
                className="gap-x-4 h-10 px-4"
                onClick={() =>
                  authClient.signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        router.refresh();
                      },
                    },
                  })
                }
              >
                <LogOutIcon className="h-4 w-4" />
                <span>Sign out</span>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton tooltip="Sign in" className="gap-x-4 h-10 px-4" onClick={() => router.push("/login")}>
                <LogInIcon className="h-4 w-4" />
                <span>Sign in</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

const menuItems: {
  title: string;
  items: { title: string; icon: typeof HomeIcon; url: string; section?: KnowledgeSection }[];
}[] = [
  {
    title: "Main",
    items: [
      {
        title: "Dashboard",
        icon: HomeIcon,
        url: "/dashboard",
      },
      {
        title: "Learnings",
        icon: BookIcon,
        url: "/learnings",
        section: "learnings",
      },
      {
        title: "Career",
        icon: BriefcaseIcon,
        url: "/career",
        section: "career",
      },
      {
        title: "Projects",
        icon: FolderOpenIcon,
        url: "/projects",
        section: "projects",
      },
      {
        title: "AI Workflows",
        icon: BotIcon,
        url: "/workflows",
        section: "workflows",
      },
    ],
  },
  {
    title: "AI",
    items: [
      {
        title: "AI Chat",
        icon: SparklesIcon,
        url: "/chat",
      },
    ],
  },
];
