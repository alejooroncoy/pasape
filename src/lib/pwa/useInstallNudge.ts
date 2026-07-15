"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getDeferredPrompt,
  getEverCaptured,
  getInstalled,
  setDeferredPrompt,
  setInstalled,
  subscribe,
} from "./installPromptStore";

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
  const everCaptured = useSyncExternalStore(subscribe, getEverCaptured, () => false);

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
    // No esperamos al evento `appinstalled` (puede tardar) para no dejar un
    // hueco donde el CTA cae a "Ver cómo" — con "accepted" el usuario ya tomó
    // la decisión; si el evento del navegador llega después, es un no-op.
    if (outcome === "accepted") setInstalled(true);
    return outcome;
  };

  const canPromptNative = !!deferred;
  // Solo afirmamos "está en un WebView de terceros" en Android si NUNCA llegó
  // el evento nativo — usar `!canPromptNative` acá confundía a alguien que ya
  // vio el diálogo de Chrome y lo aceptó/rechazó (deferred se limpia tras
  // usarse una vez) con alguien que sigue atrapado en el WebView de WhatsApp.
  const androidLikelyInWebview = platform === "android" && !everCaptured && androidGraceElapsed;
  // Ya vimos el prompt nativo pero se usó (aceptado o rechazado): no hay nada
  // más que ofrecer por código — solo indicar que puede instalarla luego a mano.
  const androidPromptConsumed = platform === "android" && everCaptured && !canPromptNative && !installed;

  const show = !!platform && !standalone && !installed && !dismissed;

  return {
    show,
    platform,
    canPromptNative,
    androidLikelyInWebview,
    androidPromptConsumed,
    promptInstall,
    dismiss,
  };
}
