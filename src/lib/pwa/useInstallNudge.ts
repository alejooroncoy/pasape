"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getDeferredPrompt, getInstalled, setDeferredPrompt, subscribe } from "./installPromptStore";

export type InstallPlatform = "ios" | "android" | null;

const DISMISS_KEY = "pasape:install_nudge_dismissed";
// Si Chrome real no soltó `beforeinstallprompt` en este tiempo, lo más probable
// es que estemos en el WebView de un tercero (WhatsApp, Instagram…), que nunca
// lo dispara. No es una detección exacta — es la señal disponible.
const ANDROID_WEBVIEW_GRACE_MS = 2000;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true);

function detectPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ se anuncia como Mac pero tiene touch — a diferencia de un Mac real.
  if (/macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return "ios";
  if (/android/i.test(ua)) return "android";
  return null;
}

export function useInstallNudge() {
  const deferred = useSyncExternalStore(subscribe, getDeferredPrompt, () => null);
  const installed = useSyncExternalStore(subscribe, getInstalled, () => false);

  const [platform, setPlatform] = useState<InstallPlatform>(null);
  const [standalone, setStandalone] = useState(true); // default cauto: no parpadea el aviso
  const [dismissed, setDismissed] = useState(true);
  const [androidGraceElapsed, setAndroidGraceElapsed] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
    setStandalone(isStandalone());
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
    const t = setTimeout(() => setAndroidGraceElapsed(true), ANDROID_WEBVIEW_GRACE_MS);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  const promptInstall = async () => {
    if (!deferred) return null;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferredPrompt(null);
    return outcome;
  };

  const canPromptNative = !!deferred;
  // Solo afirmamos "está en un WebView de terceros" en Android una vez pasado
  // el margen de gracia y sin prompt nativo — antes de eso, simplemente no lo
  // sabemos todavía (Chrome real también tarda en decidir si ofrece instalar).
  const androidLikelyInWebview = platform === "android" && !canPromptNative && androidGraceElapsed;

  const show = !!platform && !standalone && !installed && !dismissed;

  return { show, platform, canPromptNative, androidLikelyInWebview, promptInstall, dismiss };
}
