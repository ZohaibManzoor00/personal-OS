import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Lora,
  Montserrat,
  Outfit,
  Space_Mono,
} from "next/font/google";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ActiveThemeProvider } from "@/components/active-theme";
import { NavHotkeys } from "@/components/nav-hotkeys";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { DEFAULT_THEME, isValidTheme, THEME_COOKIE_NAME } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { TRPCReactProvider } from "@/trpc/client";

import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Loaded so the "Teenage Lobster" color theme can switch the UI to JetBrains Mono.
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });
// Loaded so the "Claude" color theme can switch the UI to Outfit.
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
// Loaded so the "MX Brutalist" color theme can switch the UI to Montserrat /
// Lora / Space Mono.
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"] });
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  variable: "--font-space-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Zo's Journey", template: "%s | Zo" },
  description: "Zo's journey",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const activeTheme = isValidTheme(cookieTheme) ? cookieTheme : DEFAULT_THEME;

  return (
    <TRPCReactProvider>
      <html
        lang="en"
        suppressHydrationWarning
        className={cn(
          "h-full",
          "antialiased",
          geistSans.variable,
          geistMono.variable,
          jetbrainsMono.variable,
          outfit.variable,
          montserrat.variable,
          lora.variable,
          spaceMono.variable,
          "font-sans",
          inter.variable,
        )}
      >
        <body className={cn("min-h-full flex flex-col", `theme-${activeTheme}`)}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ActiveThemeProvider initialTheme={activeTheme}>
              <NuqsAdapter>
                <TooltipProvider>{children}</TooltipProvider>
              </NuqsAdapter>
              <NavHotkeys />
              <Toaster />
            </ActiveThemeProvider>
          </ThemeProvider>
        </body>
      </html>
    </TRPCReactProvider>
  );
}
