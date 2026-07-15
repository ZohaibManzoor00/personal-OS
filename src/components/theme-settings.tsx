"use client";

import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { useActiveTheme } from "@/components/active-theme";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { COLOR_THEMES } from "@/lib/themes";
import { cn } from "@/lib/utils";

const MODES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const { activeTheme, setActiveTheme } = useActiveTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <SidebarMenuButton tooltip="Theme" className="gap-x-4 h-10 px-4">
          <Palette className="h-4 w-4" />
          <span>Theme</span>
        </SidebarMenuButton>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-64 gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Mode</span>
          <div className="grid grid-cols-3 gap-1.5">
            {MODES.map(({ value, label, icon: Icon }) => {
              const isActive = mounted && theme === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border border-border bg-background px-2 py-2 text-xs transition-colors hover:bg-muted",
                    isActive &&
                      "border-primary bg-muted text-foreground ring-1 ring-primary",
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Color theme
          </span>
          <div className="flex flex-col gap-1">
            {COLOR_THEMES.map((colorTheme) => {
              const isActive = activeTheme === colorTheme.value;
              return (
                <button
                  key={colorTheme.value}
                  type="button"
                  onClick={() => setActiveTheme(colorTheme.value)}
                  className={cn(
                    "flex items-center justify-between rounded-md border border-transparent px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                    isActive && "border-border bg-muted",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex items-center -space-x-1">
                      <span
                        className="size-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: colorTheme.swatch.primary }}
                      />
                      <span
                        className="size-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: colorTheme.swatch.secondary }}
                      />
                      <span
                        className="size-3.5 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: colorTheme.swatch.accent }}
                      />
                    </span>
                    {colorTheme.label}
                  </span>
                  {isActive && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
