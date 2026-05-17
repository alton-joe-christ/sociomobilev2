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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                if (!('serviceWorker' in navigator)) return;

                // Aggressively unregister any bad/corrupted service workers (like onesignalsdkworker.js)
                (async () => {
                  try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const reg of regs) {
                      if (reg.active && (reg.active.scriptURL.includes('onesignalsdkworker') || reg.scope.includes('push'))) {
                        console.log('[OneSignal Cleanup] Removing bad worker:', reg.active.scriptURL);
                        await reg.unregister();
                      }
                    }
                  } catch (e) {}
                })();

                // Disable SW in native Capacitor environment to avoid double-caching and hydration issues
                if (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform() !== 'web') {
                  return;
                }

                const disableSW = ${process.env.NODE_ENV !== "production"} || location.hostname === 'localhost' || location.hostname === '127.0.0.1';


                const clearServiceWorkerState = async () => {
                  try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map((registration) => registration.unregister()));
                    const keys = await caches.keys();
                    await Promise.all(keys.map((key) => caches.delete(key)));
                  } catch {}
                };

                if (disableSW) {
                  // Run cleanup as early as possible so hydration doesn't race with stale worker caches.
                  if (navigator.serviceWorker.controller && !sessionStorage.getItem('socio-sw-cleared')) {
                    sessionStorage.setItem('socio-sw-cleared', '1');
                    clearServiceWorkerState().finally(() => location.reload());
                    return;
                  }

                  clearServiceWorkerState().finally(() => {
                    sessionStorage.removeItem('socio-sw-cleared');
                  });
                  return;
                }

                // window.addEventListener('load', async () => {
                //   try {
                //     const registration = await navigator.serviceWorker.register('/sw.js');
                //     if (registration.waiting) {
                //       registration.waiting.postMessage('SKIP_WAITING');
                //     }
                // 
                //     navigator.serviceWorker.ready.then(() => {
                //       if (navigator.serviceWorker.controller) {
                //         navigator.serviceWorker.controller.postMessage('WARM_CACHE');
                //       }
                //     });
                //   } catch {}
                // });
              })();
            `,
          }}
        />
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
