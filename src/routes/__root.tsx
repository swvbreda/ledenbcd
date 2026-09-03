import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/hooks/useAuth";
import { MembersDataProvider } from "@/contexts/MembersDataContext";
import { PushNotificationInit } from "@/components/PushNotificationInit";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0, viewport-fit=cover" },
      { title: "BCD Ledenportaal" },
      { name: "description", content: "Ledenportaal van de Bond van Cannabis Detaillisten" },
      { name: "robots", content: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
      { property: "og:title", content: "BCD Ledenportaal" },
      {
        property: "og:description",
        content: "Ledenportaal van de Bond van Cannabis Detaillisten",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://leden.coffeeshopbond.nl/" },
      { property: "og:image", content: "https://leden.coffeeshopbond.nl/og-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BCD Ledenportaal" },
      {
        name: "twitter:description",
        content: "Ledenportaal van de Bond van Cannabis Detaillisten",
      },
      { name: "twitter:image", content: "https://leden.coffeeshopbond.nl/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Barlow:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "apple-touch-icon", href: "/app-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MembersDataProvider>
          <TooltipProvider>
            <PushNotificationInit />
            <Toaster />
            <Sonner />
            <SidebarProvider>
              <Outlet />
            </SidebarProvider>
          </TooltipProvider>
        </MembersDataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-xl font-bold">This page didn't load</h1>
        <p className="text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground"
            onClick={() => {
              void router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <a className="px-4 py-2 rounded-md border border-border bg-background" href="/">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
