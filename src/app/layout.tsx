import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ActiveThemeProvider } from "@/components/active-theme";
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

export const metadata: Metadata = {
  title: { default: "Zo's Journey", template: "%s | Zo" },
  description: "Zo's journey",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
          "font-sans",
          inter.variable,
        )}
      >
        <body
          className={cn("min-h-full flex flex-col", `theme-${activeTheme}`)}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ActiveThemeProvider initialTheme={activeTheme}>
              <NuqsAdapter>
                <TooltipProvider>{children}</TooltipProvider>
              </NuqsAdapter>
              <Toaster />
            </ActiveThemeProvider>
          </ThemeProvider>
        </body>
      </html>
    </TRPCReactProvider>
  );
}
