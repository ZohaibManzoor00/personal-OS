"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { DEFAULT_THEME, THEME_COOKIE_NAME } from "@/lib/themes";

function setThemeCookie(theme: string) {
  if (typeof window === "undefined") return;
  const secure = window.location.protocol === "https:" ? "Secure;" : "";
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=31536000; SameSite=Lax; ${secure}`;
}

type ActiveThemeContextValue = {
  activeTheme: string;
  setActiveTheme: (theme: string) => void;
};

const ActiveThemeContext = createContext<ActiveThemeContextValue | undefined>(
  undefined,
);

export function ActiveThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme?: string;
}) {
  const [activeTheme, setActiveTheme] = useState(
    () => initialTheme || DEFAULT_THEME,
  );

  useEffect(() => {
    setThemeCookie(activeTheme);

    for (const className of Array.from(document.body.classList)) {
      if (className.startsWith("theme-")) {
        document.body.classList.remove(className);
      }
    }
    document.body.classList.add(`theme-${activeTheme}`);
  }, [activeTheme]);

  return (
    <ActiveThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      {children}
    </ActiveThemeContext.Provider>
  );
}

export function useActiveTheme() {
  const context = useContext(ActiveThemeContext);
  if (!context) {
    throw new Error("useActiveTheme must be used within an ActiveThemeProvider");
  }
  return context;
}
