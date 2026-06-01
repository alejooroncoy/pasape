"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { C, FONT_DISPLAY } from "@/components/design";
import { useScanQr } from "@/lib/scanning/hooks/useScanQr";
import { refreshScanCache } from "@/lib/scanning/scanCache";
import { useOnlineStatus } from "@/lib/_shared/useOnlineStatus";
import { scanLocal } from "@/lib/scanning/scanLocal";
import { countPending } from "@/lib/scanning/scanQueue";
import { syncPending } from "@/lib/scanning/syncWorker";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";

// ─── Haptic feedback ───────────────────────────────────────────────────────
const haptic = (kind: "valid" | "already_used" | "invalid") => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (kind === "valid")             navigator.vibrate([50]);
  else if (kind === "already_used") navigator.vibrate([30, 30, 30]);
  else                              navigator.vibrate([100, 50, 100]);
};

// ─── Tipos ─────────────────────────────────────────────────────────────────
type ScanKind = "valid" | "already_used" | "invalid";
type ScanResult = {
  kind: ScanKind;
  holderName: string | null;
  typeName: string | null;
  dniLast2: string | null;
  boxLabel: string | null;
  scannedAt?: string | null;
};

type DetectorLike = {
  detect: (source: CanvasImageSource | ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

const getDetector = (): DetectorLike | null => {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (window as any).BarcodeDetector;
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: ["qr_code"] }) as DetectorLike;
  } catch {
    return null;
  }
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

// ─── Colores por resultado ─────────────────────────────────────────────────
function toneFor(kind: ScanKind) {
  if (kind === "valid")        return "#22C55E"; // green-500
  if (kind === "already_used") return "#EF4444"; // red-500
  return "#EF4444";
}

// ─── Componente principal ───────────────────────────────────────────────────
export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanPageInner />
    </Suspense>
  );
}

function ScanPageInner() {
  const scan       = useScanQr();
  const search     = useSearchParams();
  const eventSlug  = search.get("event");
  const online     = useOnlineStatus();

  // Hooks de datos del evento
  const eventData  = useEvent(eventSlug ?? "");
  const statsData  = useEventStats(eventSlug ?? "");

  const ev         = eventData.data?.event;
  const validated  = statsData.data?.validated ?? 0;
  const capacity   = statsData.data?.capacity ?? 0;
  const aforo      = capacity > 0 ? Math.round((validated / capacity) * 100) : 0;
  const afoWarning = capacity > 0 && aforo >= 90;

  // Refs de cámara
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const lastCodeRef = useRef<string>("");

  const [active,       setActive]       = useState(false);
  const [result,       setResult]       = useState<ScanResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [cornerColor,  setCornerColor]  = useState<string>(C.purple);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Funciones de cámara ──────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const showResult = useCallback((r: ScanResult) => {
    setResult(r);
    setCornerColor(toneFor(r.kind));
    haptic(r.kind);
    if (resultTimer.current) clearTimeout(resultTimer.current);
    resultTimer.current = setTimeout(() => {
      setResult(null);
      setCornerColor(C.purple);
      lastCodeRef.current = "";
    }, 3000);
  }, []);

  const runScan = useCallback(
    async (code: string) => {
      if (!code || code === lastCodeRef.current) return;
      lastCodeRef.current = code;
      try {
        const raw = online ? await scan.mutateAsync(code) : await scanLocal(code);
        showResult({
          kind:       (raw.kind as ScanKind) ?? "invalid",
          holderName: raw.holderName ?? null,
          typeName:   raw.ticketTypeName ?? null,
          dniLast2:   raw.holderDniLast2 ?? null,
          boxLabel:   raw.boxLabel ?? null,
          scannedAt:  ("scannedAt" in raw ? raw.scannedAt : null) ?? null,
        });
      } catch {
        showResult({ kind: "invalid", holderName: null, typeName: "QR no reconocido", dniLast2: null, boxLabel: null });
      }
    },
    [scan, online, showResult],
  );

  const loop = useCallback(
    async function scanLoop(detector: DetectorLike) {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(() => void scanLoop(detector));
        return;
      }
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) await runScan(codes[0].rawValue);
      } catch {}
      rafRef.current = requestAnimationFrame(() => void scanLoop(detector));
    },
    [runScan],
  );

  const startCamera = useCallback(async () => {
    const detector = getDetector();
    if (!detector) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      rafRef.current = requestAnimationFrame(() => loop(detector));
    } catch {}
  }, [loop]);

  useEffect(() => () => { stopCamera(); if (resultTimer.current) clearTimeout(resultTimer.current); }, [stopCamera]);

  // ── Sync offline cache ───────────────────────────────────────────────────
  useEffect(() => {
    if (!eventSlug) return;
    let cancel = false;
    const sync = () => refreshScanCache(eventSlug).catch(() => {});
    void sync();
    const id = setInterval(() => { if (!cancel && navigator.onLine) void sync(); }, 60_000);
    return () => { cancel = true; clearInterval(id); };
  }, [eventSlug]);

  useEffect(() => {
    let cancel = false;
    const refresh = async () => { if (!cancel) setPendingCount(await countPending()); };
    void refresh();
    const id = setInterval(refresh, 2000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!online || !eventSlug) return;
    void syncPending(eventSlug).then(() => { void (async () => setPendingCount(await countPending()))(); });
  }, [online, eventSlug]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#09090B",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_DISPLAY,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        color: "#fff",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px rgba(255,255,255,0.12) inset, 0 6px 18px -4px rgba(124,58,237,0.6)` }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 7L7 13L1 7L7 1Z" fill="#fff" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1 }}>pasape</div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", letterSpacing: "0.02em" }}>Modo puerta</div>
          </div>
        </div>
        {/* Online / Offline + pending */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pendingCount > 0 && (
            <div style={{ padding: "3px 9px", borderRadius: 999, background: "rgba(251,191,36,0.15)", fontSize: 10, fontWeight: 700, color: "#FCD34D", letterSpacing: "0.06em" }}>
              {pendingCount} pend.
            </div>
          )}
          <div style={{ padding: "4px 10px", borderRadius: 999, background: online ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)", fontSize: 10, fontWeight: 700, color: online ? "#4ADE80" : "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 5, letterSpacing: "0.06em" }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: online ? "#4ADE80" : "rgba(255,255,255,0.3)", boxShadow: online ? "0 0 6px #4ADE80" : "none", display: "inline-block" }} />
            {online ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* ── Aforo warning banner ────────────────────────────────────────── */}
      {afoWarning && (
        <div style={{ margin: "10px 18px 0", padding: "8px 14px", borderRadius: 12, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: "#FCA5A5" }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "#EF4444", boxShadow: "0 0 6px #EF4444", flexShrink: 0, display: "inline-block" }} />
          AFORO {aforo}% · cuidado al dejar entrar · {validated}/{capacity}
        </div>
      )}

      {/* ── Info del evento (solo en idle) ──────────────────────────────── */}
      {ev && !result && (
        <div style={{ padding: "14px 18px 0", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, color: "#fff" }}>
            {ev.title}
          </div>
          {ev.venue && (
            <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>
              {typeof ev.venue === "string" ? ev.venue : (ev.venue as { label?: string }).label ?? ""} · {new Date(ev.startsAt).toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          )}

          {/* Stats */}
          {capacity > 0 && (
            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div style={{ padding: "10px 14px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4 }}>Ingresadas</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                  <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em" }}>{validated}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>/ {capacity}</span>
                </div>
              </div>
              <div style={{ padding: "10px 14px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 4 }}>Aforo</div>
                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", color: aforo >= 90 ? "#FCA5A5" : aforo >= 70 ? "#FCD34D" : "#4ADE80" }}>
                  {aforo}%
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Counter (solo mientras hay resultado) ───────────────────────── */}
      {result && (
        <div style={{ padding: "14px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>
            {validated + 1} ingresadas
          </div>
          <button
            type="button"
            onClick={() => { setResult(null); setCornerColor(C.purple); lastCodeRef.current = ""; }}
            style={{ width: 32, height: 32, borderRadius: 999, background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          </button>
        </div>
      )}

      {/* ── Viewfinder (cámara / placeholder) ───────────────────────────── */}
      <div style={{ flex: 1, padding: "14px 18px", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            position: "relative",
            flex: 1,
            borderRadius: 22,
            overflow: "hidden",
            background: "#0A0A0C",
          }}
        >
          {/* Video */}
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: active ? 1 : 0,
              transition: "opacity 0.3s",
            }}
          />

          {/* Idle placeholder */}
          {!active && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {/* Grid de cuadros oscuros como en la imagen */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 3, opacity: 0.15 }}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} style={{ width: 56, height: 56, borderRadius: 8, background: "rgba(255,255,255,0.12)" }} />
                ))}
              </div>
              <div style={{ position: "absolute", bottom: 16, fontSize: 12, color: "rgba(255,255,255,0.3)", fontWeight: 500, letterSpacing: "0.02em" }}>
                Apunta al código QR
              </div>
            </div>
          )}

          {/* Scanline animada */}
          {active && (
            <div
              style={{
                position: "absolute",
                left: "10%", right: "10%",
                height: 2,
                borderRadius: 999,
                background: result
                  ? `linear-gradient(90deg, transparent, ${toneFor(result.kind)}, transparent)`
                  : "linear-gradient(90deg, transparent, #22C55E, transparent)",
                boxShadow: result
                  ? `0 0 12px 3px ${toneFor(result.kind)}88`
                  : "0 0 12px 3px rgba(34,197,94,0.6)",
                top: "50%",
                animation: "scan-slide 2s ease-in-out infinite",
              }}
            />
          )}

          {/* Esquinas del viewfinder */}
          {[
            { top: 14, left: 14 },
            { top: 14, right: 14 },
            { bottom: 14, left: 14 },
            { bottom: 14, right: 14 },
          ].map((pos, i) => {
            const isRight  = "right" in pos;
            const isBottom = "bottom" in pos;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", ...pos,
                  width: 24, height: 24,
                  borderTop:    !isBottom ? `2.5px solid ${cornerColor}` : "none",
                  borderBottom: isBottom  ? `2.5px solid ${cornerColor}` : "none",
                  borderLeft:   !isRight  ? `2.5px solid ${cornerColor}` : "none",
                  borderRight:  isRight   ? `2.5px solid ${cornerColor}` : "none",
                  transition: "border-color 0.2s ease",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* ── Resultado card ──────────────────────────────────────────────── */}
      {result && (
        <div style={{ padding: "0 18px 12px", flexShrink: 0 }}>
          <div
            style={{
              padding: "14px 16px",
              borderRadius: 18,
              background: result.kind === "valid"
                ? "rgba(34,197,94,0.15)"
                : "rgba(239,68,68,0.15)",
              border: `1px solid ${result.kind === "valid" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {/* Ícono */}
            <div
              style={{
                width: 42, height: 42, borderRadius: 999, flexShrink: 0,
                background: result.kind === "valid" ? "#22C55E" : "#EF4444",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 16px ${result.kind === "valid" ? "#22C55E" : "#EF4444"}66`,
              }}
            >
              {result.kind === "valid" ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10l4 4 8-10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 4l10 10M14 4L4 14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              )}
            </div>

            {/* Texto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.2, color: "#fff" }}>
                {result.kind === "valid"
                  ? (result.holderName ?? "Entrada válida")
                  : result.kind === "already_used"
                    ? `Ya ingresó${result.scannedAt ? ` a las ${formatTime(result.scannedAt)}` : ""}`
                    : "QR inválido"}
              </div>
              <div style={{ marginTop: 3, fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>
                {result.kind === "valid"
                  ? [result.typeName, result.boxLabel ? `Box ${result.boxLabel}` : null].filter(Boolean).join(" · ")
                  : result.kind === "already_used"
                    ? (result.holderName ?? "")
                    : (result.typeName ?? "")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Botones inferiores ──────────────────────────────────────────── */}
      <div style={{ padding: "0 18px calc(env(safe-area-inset-bottom, 0px) + 20px)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
        {/* Botón principal */}
        <button
          type="button"
          onClick={active ? stopCamera : startCamera}
          style={{
            height: 56,
            borderRadius: 18,
            border: 0,
            background: active ? "rgba(255,255,255,0.08)" : C.purple,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            boxShadow: active ? "none" : "0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 32px -8px rgba(124,58,237,0.65)",
            transition: "background 0.2s, box-shadow 0.2s",
          }}
        >
          {/* Ícono de scanner */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            <rect x="12" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            <rect x="1" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M12 12h2M14 12v2M12 14h2M16 14v2M14 16h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          {active ? "Detener escaneo" : "Iniciar escaneo"}
        </button>

        {/* Buscar por nombre o DNI */}
        <button
          type="button"
          style={{
            height: 46,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.45)",
            fontFamily: FONT_DISPLAY,
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
          }}
          onClick={() => {/* TODO: abrir busqueda */}}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Buscar por nombre o DNI
        </button>
      </div>

      {/* Animación scanline */}
      <style>{`
        @keyframes scan-slide {
          0%   { top: 20%; }
          50%  { top: 80%; }
          100% { top: 20%; }
        }
      `}</style>
    </div>
  );
}
