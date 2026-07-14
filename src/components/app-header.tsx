import { APP_HEADER_SLOT_ID } from "@/components/header-portal";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background">
      <SidebarTrigger />
      <div
        id={APP_HEADER_SLOT_ID}
        className="flex min-w-0 flex-1 items-center gap-4"
      />
    </header>
  );
}
