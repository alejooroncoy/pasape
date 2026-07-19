"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";
import { trackPageView, trackDeferredPageView } from "@/lib/analytics/track";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // `useSearchParams()` puede entregar una nueva instancia durante renders
  // sucesivos. El string sí es estable mientras la URL no cambie; depender del
  // objeto hacía que rutas con `?next=` dispararan pageviews sin parar.
  const query = searchParams.toString();

  useEffect(() => {
    const path = query ? `${pathname}?${query}` : pathname;

    posthog.capture("page_view", { page_path: path });
    trackPageView(path);

    // TikTok va en lazyOnload — reintento solo si aún no cargó.
    if (!trackDeferredPageView()) {
      const deferred = window.setTimeout(() => trackDeferredPageView(), 3000);
      return () => window.clearTimeout(deferred);
    }
  }, [pathname, query]);

  return null;
}
