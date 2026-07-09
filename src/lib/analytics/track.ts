declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: {
      track: (event: string, properties?: Record<string, unknown>) => void;
      page: () => void;
    };
  }
}

type TrackProps = Record<string, unknown>;

export function trackAnalyticsEvent(event: string, properties?: TrackProps) {
  if (typeof window === "undefined") return;

  if (typeof window.gtag === "function") {
    window.gtag("event", event, properties);
  }

  if (typeof window.fbq === "function") {
    window.fbq("trackCustom", event, properties);
  }

  if (window.ttq?.track) {
    window.ttq.track(event, properties);
  }
}

export function trackPageView(path: string) {
  trackAnalyticsEvent("page_view", { page_path: path });

  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq("track", "PageView");
  }
}

/** Pixels diferidos (lazyOnload). Retorna true si TikTok ya estaba listo. */
export function trackDeferredPageView(): boolean {
  if (typeof window !== "undefined" && window.ttq?.page) {
    window.ttq.page();
    return true;
  }
  return false;
}
