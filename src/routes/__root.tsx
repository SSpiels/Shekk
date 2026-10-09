import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { AppProvider } from "@/lib/store";
import { RequireAccount } from "@/components/RequireAccount";
import { ChatNotifications } from "@/components/ChatNotifications";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

const CHUNK_RELOAD_KEY = "shekk:chunk-reload";

function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Loading chunk .* failed|dynamically imported module/i.test(
    message,
  );
}

/** Stale or failed lazy-route chunks leave a blank screen; recover with a single reload. */
function recoverFromChunkError(error: unknown) {
  if (typeof window === "undefined" || !isChunkLoadError(error)) return false;
  try {
    if (window.sessionStorage.getItem(CHUNK_RELOAD_KEY)) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  } catch {
    // sessionStorage unavailable — fall through to a single reload attempt.
  }
  window.location.reload();
  return true;
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    recoverFromChunkError(error);
  }, [error]);


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#010e60" },
      { name: "apple-mobile-web-app-title", content: "Shekk" },
      { name: "impact-site-verification", value: "de536f76-ea4e-4828-b5e2-2c4499cedc97" },
      { title: "Shekk — everything you need for your year in Israel" },
      {
        name: "description",
        content:
          "Shekk is the programme-aware app for a gap year or programme year in Israel: your schedule and updates, what's on near you, setup essentials like an eSIM and insurance, and practical tools for living here.",
      },
      { name: "author", content: "Shekk" },
      { property: "og:title", content: "Shekk — everything you need for your year in Israel" },
      {
        property: "og:description",
        content:
          "Programme schedule and updates, activities near you, Israel setup essentials and everyday tools — in one app.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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

  useEffect(() => {
    try {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // ignore
    }
    const onPreloadError = (event: Event) => {
      const detail = (event as Event & { payload?: unknown }).payload;
      if (recoverFromChunkError(detail)) event.preventDefault();
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (recoverFromChunkError(event.reason)) event.preventDefault();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("vite:preloadError", onPreloadError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ChatNotifications />
        <Toaster position="top-center" />
        <RequireAccount>
          {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
          <Outlet />
        </RequireAccount>
      </AppProvider>
    </QueryClientProvider>
  );
}

