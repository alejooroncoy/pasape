"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";
import { trackPageView } from "@/lib/analytics/track";

export function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;

    posthog.capture("page_view", { page_path: path });
    trackPageView(path);
  }, [pathname, searchParams]);

  return null;
}
