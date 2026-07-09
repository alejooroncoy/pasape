"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";
import { trackPageView, trackDeferredPageView } from "@/lib/analytics/track";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;

    posthog.capture("page_view", { page_path: path });
    trackPageView(path);

    // TikTok va en lazyOnload — reintento solo si aún no cargó.
    if (!trackDeferredPageView()) {
      const deferred = window.setTimeout(() => trackDeferredPageView(), 3000);
      return () => window.clearTimeout(deferred);
    }
  }, [pathname, searchParams]);

  return null;
}
