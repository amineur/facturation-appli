import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { DataProvider } from "@/components/data-provider";
import { Toaster } from "sonner";
import { FaviconUpdater, DebugLogger } from "@/components/features/GlobalLazyLoaders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { fetchSocietes } from "@/app/actions";

export async function generateMetadata(): Promise<Metadata> {
  let icons: any = {
    icon: '/favicon.ico', // Default fallback
    apple: '/favicon.ico',
  };

  // Skip DB call during build to avoid Prisma quota errors
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

  if (!isBuildPhase) {
    try {
      const result = await fetchSocietes();
      if (result.success && result.data && result.data.length > 0) {
        const societe = result.data[0];
        if (societe.logoUrl) {
          // Use the logo directly. 
          // Note: For Data URIs, this works fine in metadata.
          // For server-side rendering, we can't easily "cache bust" with a timestamp 
          // unless we want to invalidate caching frequently, but for initial load it's fine.
          icons = {
            icon: societe.logoUrl,
            apple: societe.logoUrl,
            shortcut: societe.logoUrl,
          };

          // Add specific support for SVG if detected
          if (societe.logoUrl.endsWith('.svg') || societe.logoUrl.startsWith('data:image/svg')) {
            // Metadata types for specific icons are a bit complex, strictly typing 'any' above helps
            // but ideally we'd construct the object carefully.
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch metadata icons", error);
    }
  }

  return {
    title: {
      template: "%s | Gestion Facturation",
      default: "Gestion Facturation",
    },
    description: "Application de gestion de facturation simple et efficace",
    icons: icons,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <DataProvider>
            <DebugLogger />
            <FaviconUpdater />
            {children}
            <Toaster position="top-right" richColors theme="system" />
          </DataProvider>
        </ThemeProvider>
        <div id="glass-portal-root" />
      </body>
    </html>
  );
}
