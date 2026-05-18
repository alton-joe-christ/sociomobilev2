import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { EventProvider } from "@/context/EventContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ShakeToScanProvider } from "@/context/ShakeToScanContext";
import { NetworkProvider } from "@/context/NetworkContext";
import { LoadingProvider } from "@/components/loading";
import type { FetchedEvent } from "@/context/EventContext";
import AppShell from "./AppShell";
import { apiRequest } from "@/lib/apiClient";

export const metadata: Metadata = {
  title: "SOCIO – Campus Events",
  description: "Discover, register and stay updated on campus events.",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SOCIO" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#011F7B",
};

async function fetchEvents(): Promise<FetchedEvent[]> {
  try {
    const data: any = await apiRequest(`/events`, {
      next: { revalidate: 300 },
    } as any);
    
    // Handle both { events: [] } and { success: true, data: [] } patterns
    const events = data.events ?? data.data ?? data ?? [];
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const events = await fetchEvents();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />

      </head>
      <body>
        <NetworkProvider>
          <AuthProvider>
            <EventProvider initialEvents={events}>
              <NotificationProvider>
                <ShakeToScanProvider>
                  <LoadingProvider>
                    <AppShell>{children}</AppShell>
                  </LoadingProvider>
                </ShakeToScanProvider>
              </NotificationProvider>
            </EventProvider>
          </AuthProvider>
        </NetworkProvider>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "var(--radius)",
              fontSize: "13px",
              fontWeight: 600,
              padding: "10px 16px",
            },
            loading: {
              iconTheme: {
                primary: "#FFBA09",
                secondary: "transparent",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
