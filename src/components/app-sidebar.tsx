"use client";

import { BookIcon, BotIcon, BriefcaseIcon, FolderOpenIcon, HomeIcon, LogOutIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { authClient } from "@/lib/auth-client";
// import { useHasActiveSubscription } from "@/features/subscriptions/hooks/use-subscription";

export const AppSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  // const { hasActiveSubscription, isLoading } = useHasActiveSubscription();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="gap-x-4 h-10 px-4">
            <Link href="/" prefetch>
              <Image src="/logos/logo.svg" alt="Zeno" width={30} height={30} />
              <span className="font-semibold text-sm">Zo's Journey</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={item.url === "/" ? pathname === "/" : pathname.startsWith(item.url)}
                      asChild
                      className="gap-x-4 h-10 px-4"
                    >
                      <Link href={item.url} prefetch>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {/* {!hasActiveSubscription && !isLoading && (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Upgade to Pro" className="gap-x-4 h-10 px-4" onClick={() => authClient.checkout({ slug: "pro" })}>
                <StarIcon className="h-4 w-4" />
                <span>Upgrade to Pro</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )} */}
          {/* <SidebarMenuItem>
            <SidebarMenuButton tooltip="Billing Portal" className="gap-x-4 h-10 px-4" onClick={() => authClient.customer.portal()}>
              <CreditCardIcon className="h-4 w-4" />
              <span>Billing Portal</span>
            </SidebarMenuButton>
          </SidebarMenuItem> */}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="gap-x-4 h-10 px-4"
              onClick={() =>
                authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/login");
                    },
                  },
                })
              }
            >
              <LogOutIcon className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

const menuItems = [
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
      },
      {
        title: "Career",
        icon: BriefcaseIcon,
        url: "/career",
      },
      {
        title: "Projects",
        icon: FolderOpenIcon,
        url: "/projects",
      },
      {
        title: "AI Workflows",
        icon: BotIcon,
        url: "/workflows",
      },
    ],
  },
];
