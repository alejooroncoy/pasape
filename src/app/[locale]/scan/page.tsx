"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { C, FONT_DISPLAY, FONT_MONO } from "@/components/design";
import { useScanQr } from "@/lib/scanning/hooks/useScanQr";
import { refreshScanCache } from "@/lib/scanning/scanCache";
import { useOnlineStatus } from "@/lib/_shared/useOnlineStatus";
import { scanLocal } from "@/lib/scanning/scanLocal";
import { countPending } from "@/lib/scanning/scanQueue";
import { syncPending } from "@/lib/scanning/syncWorker";
import { useEvent } from "@/lib/events/hooks/useEvents";

// ─── Haptic ────────────────────────────────────────────────────────────────
const haptic = (kind: "valid" | "already_used" | "invalid") => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (kind === "valid")             navigator.vibrate([60]);
  else if (kind === "already_used") navigator.vibrate([40, 60, 40]);
  else                              navigator.vibrate([120, 60, 120]);
};

// ─── Tipos ─────────────────────────────────────────────────────────────────
type ScanKind = "valid" | "already_used" | "invalid";

type ScanResult = {
  kind: ScanKind;
  holderName:    string | null;
  typeName:      string | null;
  dniLast2:      string | null;
  boxLabel:      string | null;
  boxHostName:   string | null;
  scannedAt:     string | null;
};

type DetectorLike = {
  detect: (src: CanvasImageSource | ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

function getDetector(): DetectorLike | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (window as any).BarcodeDetector;
  if (!Ctor) return null;
  try { return new Ctor({ formats: ["qr_code"] }) as DetectorLike; } catch { return null; }
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const scan      = useScanQr();
  const search    = useSearchParams();
  const eventSlug = search.get("event");
  const online    = useOnlineStatus();

  // Datos del evento (nombre para el header)
  const { data: eventData } = useEvent(eventSlug ?? "");
  const ev = eventData?.event;

  // Refs de cámara
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const lastCodeRef = useRef("");
  const clearTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [active,       setActive]       = useState(false);
  const [cameraError,  setCameraError]  = useState(false);
  const [result,       setResult]       = useState<ScanResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // ── Funciones de cámara ──────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const dismissResult = useCallback(() => {
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setResult(null);
    lastCodeRef.current = "";
  }, []);

  const showResult = useCallback((r: ScanResult) => {
    setResult(r);
    haptic(r.kind);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(dismissResult, 2800);
  }, [dismissResult]);

  const runScan = useCallback(async (code: string) => {
    if (!code || code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    try {
      const raw = online ? await scan.mutateAsync(code) : await scanLocal(code);
      showResult({
        kind:        (raw.kind as ScanKind) ?? "invalid",
        holderName:  raw.holderName ?? null,
        typeName:    raw.ticketTypeName ?? null,
        dniLast2:    raw.holderDniLast2 ?? null,
        boxLabel:    raw.boxLabel ?? null,
        boxHostName: raw.boxHostName ?? null,
        scannedAt:   ("scannedAt" in raw ? raw.scannedAt : null) ?? null,
      });
    } catch {
      showResult({ kind: "invalid", holderName: null, typeName: null, dniLast2: null, boxLabel: null, boxHostName: null, scannedAt: null });
    }
  }, [scan, online, showResult]);

  const loop = useCallback(async function scanLoop(detector: DetectorLike) {
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
  }, [runScan]);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    const detector = getDetector();
    if (!detector) { setCameraError(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setActive(true);
      rafRef.current = requestAnimationFrame(() => loop(detector));
    } catch { setCameraError(true); }
  }, [loop]);

  // Auto-start cuando hay event slug
  useEffect(() => {
    void startCamera();
    return () => { stopCamera(); if (clearTimer.current) clearTimeout(clearTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync offline cache
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
    const id = setInterval(refresh, 3000);
    return () => { cancel = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!online || !eventSlug) return;
    void syncPending(eventSlug).then(() => { void (async () => setPendingCount(await countPending()))(); });
  }, [online, eventSlug]);

  // ─────────────────────────────────────────────────────────────────────────
  // Colores del resultado
  // ─────────────────────────────────────────────────────────────────────────
  const tone =
    result?.kind === "valid"        ? C.green  :
    result?.kind === "already_used" ? C.yellow :
    C.red;

  const toneSoft =
    result?.kind === "valid"        ? C.greenSoft  :
    result?.kind === "already_used" ? C.yellowSoft :
    C.redSoft;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      onClick={result ? dismissResult : undefined}
      style={{
        position: "fixed", inset: 0,
        background: C.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT_DISPLAY,
        color: C.text,
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: result ? "pointer" : "default",
      }}
    >
      {/* ── OVERLAY FULLSCREEN al escanear ──────────────────────────────── */}
      {result && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 20,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background:
              result.kind === "valid"
                ? `radial-gradient(70% 60% at 50% 45%, rgba(34,209,127,0.22) 0%, ${C.bg} 80%)`
                : result.kind === "already_used"
                  ? `radial-gradient(70% 60% at 50% 45%, rgba(255,206,59,0.18) 0%, ${C.bg} 80%)`
                  : `radial-gradient(70% 60% at 50% 45%, rgba(255,77,94,0.22) 0%, ${C.bg} 80%)`,
            padding: "0 32px",
          }}
        >
          {/* Ícono grande */}
          <div
            style={{
              width: 96, height: 96, borderRadius: "50%",
              background: tone,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 0 20px ${toneSoft}, 0 0 60px ${tone}55`,
              animation: "pop 360ms cubic-bezier(0.34,1.56,0.64,1)",
              flexShrink: 0,
            }}
          >
            {result.kind === "valid" ? (
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                <path d="M9 22l10 10 17-22" stroke={C.bg} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : result.kind === "already_used" ? (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="14" stroke={C.bg} strokeWidth="3.5"/>
                <path d="M20 12v9l5 4" stroke={C.bg} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M10 10l20 20M30 10L10 30" stroke={C.bg} strokeWidth="4.5" strokeLinecap="round"/>
              </svg>
            )}
          </div>

          {/* Título — nombre o estado */}
          <div
            style={{
              marginTop: 28,
              fontSize: result.holderName ? 42 : 34,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.0,
              textAlign: "center",
              color: C.text,
              animation: "fadeUp 300ms ease-out 80ms both",
            }}
          >
            {result.kind === "valid"
              ? (result.holderName ?? "Entrada válida")
              : result.kind === "already_used"
                ? (result.scannedAt ? `Ya ingresó · ${fmtTime(result.scannedAt)}` : "Ya ingresó antes")
                : "QR inválido"}
          </div>

          {/* Subtítulo */}
          {(result.typeName || result.dniLast2 || result.boxLabel || (result.kind === "already_used" && result.holderName)) && (
            <div
              style={{
                marginTop: 10,
                fontSize: 18,
                fontWeight: 500,
                color: C.dim,
                textAlign: "center",
                letterSpacing: "-0.01em",
                animation: "fadeUp 300ms ease-out 160ms both",
              }}
            >
              {result.kind === "already_used"
                ? result.holderName
                : [
                    result.typeName,
                    result.dniLast2 ? `DNI ··${result.dniLast2}` : null,
                    result.boxLabel ? `Box ${result.boxLabel}` : null,
                    result.boxHostName ? `por ${result.boxHostName}` : null,
                  ].filter(Boolean).join("  ·  ")}
            </div>
          )}

          {/* Toca para continuar */}
          <div
            style={{
              position: "absolute",
              bottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)",
              fontSize: 13,
              color: C.dimmer,
              letterSpacing: "0.04em",
              fontWeight: 500,
              animation: "fadeUp 300ms ease-out 400ms both",
            }}
          >
            Toca para continuar
          </div>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: "12px 20px 0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, zIndex: 10,
      }}>
        {/* Logo + evento */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11,
            background: C.purple,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 4px 16px ${C.purpleEdge}`,
          }}>
            {/* Diamante Pasape */}
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 7L7 13L1 7L7 1Z" fill="#fff"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
              {ev?.title ?? "pasape"}
            </div>
            <div style={{ fontSize: 10, color: C.dimmer, letterSpacing: "0.03em" }}>
              Modo puerta
            </div>
          </div>
        </div>

        {/* Estado de conexión */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {pendingCount > 0 && (
            <div style={{
              padding: "3px 8px", borderRadius: 999,
              background: C.yellowSoft, fontSize: 10,
              fontWeight: 700, color: C.yellow, letterSpacing: "0.06em",
            }}>
              {pendingCount} pend.
            </div>
          )}
          <div style={{
            padding: "4px 10px", borderRadius: 999,
            background: online ? C.greenSoft : "rgba(255,255,255,0.06)",
            fontSize: 10, fontWeight: 700,
            color: online ? C.green : C.dimmer,
            display: "flex", alignItems: "center", gap: 5,
            letterSpacing: "0.06em",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: online ? C.green : C.dimmer,
              boxShadow: online ? `0 0 6px ${C.green}` : "none",
              display: "inline-block",
            }}/>
            {online ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* ── VIEWFINDER ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "14px 20px", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          flex: 1, position: "relative",
          borderRadius: 24,
          overflow: "hidden",
          background: C.bg2,
          border: `1px solid ${C.line}`,
        }}>
          {/* Video */}
          <video
            ref={videoRef}
            playsInline muted
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: active ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          />

          {/* Placeholder idle */}
          {!active && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 12,
            }}>
              {cameraError ? (
                <>
                  <div style={{ fontSize: 32 }}>📵</div>
                  <div style={{ fontSize: 14, color: C.dim, textAlign: "center", padding: "0 24px" }}>
                    Sin acceso a la cámara
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{
                      marginTop: 8, padding: "10px 20px", borderRadius: 12,
                      border: `1px solid ${C.line2}`,
                      background: C.bg3, color: C.text,
                      fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reintentar
                  </button>
                </>
              ) : (
                <>
                  {/* Indicador de carga */}
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0,1,2].map((i) => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: C.purple,
                        animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                      }}/>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, color: C.dimmer, fontWeight: 500 }}>
                    Iniciando cámara…
                  </div>
                </>
              )}
            </div>
          )}

          {/* Scanline activa */}
          {active && !result && (
            <div style={{
              position: "absolute",
              left: "8%", right: "8%",
              height: 2,
              background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`,
              boxShadow: `0 0 16px 4px ${C.green}66`,
              borderRadius: 999,
              animation: "scanline 2.4s ease-in-out infinite",
            }}/>
          )}

          {/* Esquinas del frame */}
          {(["tl","tr","bl","br"] as const).map((pos) => {
            const isRight  = pos.includes("r");
            const isBottom = pos.includes("b");
            const color = result ? tone : C.purple;
            return (
              <div
                key={pos}
                style={{
                  position: "absolute",
                  top:    isBottom ? undefined : 16,
                  bottom: isBottom ? 16        : undefined,
                  left:   isRight  ? undefined : 16,
                  right:  isRight  ? 16        : undefined,
                  width: 28, height: 28,
                  borderTop:    !isBottom ? `3px solid ${color}` : "none",
                  borderBottom: isBottom  ? `3px solid ${color}` : "none",
                  borderLeft:   !isRight  ? `3px solid ${color}` : "none",
                  borderRight:  isRight   ? `3px solid ${color}` : "none",
                  transition: "border-color 0.25s ease",
                }}
              />
            );
          })}

          {/* Label inferior cuando está activo */}
          {active && !result && (
            <div style={{
              position: "absolute", bottom: 16, left: 0, right: 0,
              textAlign: "center", fontSize: 12,
              color: C.dimmer, fontWeight: 500, letterSpacing: "0.03em",
            }}>
              Apunta al código QR
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      {!result && (
        <div style={{
          padding: "0 20px calc(env(safe-area-inset-bottom, 0px) + 20px)",
          flexShrink: 0,
        }}>
          {active ? (
            /* Barra de estado mientras escanea */
            <div style={{
              height: 50,
              borderRadius: 14,
              background: C.bg2,
              border: `1px solid ${C.line}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 999,
                background: C.green,
                boxShadow: `0 0 8px ${C.green}`,
                display: "inline-block",
                animation: "pulse 1.4s ease-in-out infinite",
              }}/>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.dim }}>
                Escaneando…
              </span>
            </div>
          ) : !cameraError && (
            /* Botón de inicio (solo si la cámara no arrancó sola) */
            <button
              type="button"
              onClick={startCamera}
              style={{
                width: "100%", height: 54,
                borderRadius: 16, border: 0,
                background: C.purple,
                color: C.text,
                fontFamily: FONT_DISPLAY,
                fontSize: 16, fontWeight: 700,
                letterSpacing: "-0.01em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                cursor: "pointer",
                boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 32px -8px ${C.purpleEdge}`,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <rect x="12" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <rect x="1" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M12 12h2v2h-2zM14 14h2v2h-2z" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              Iniciar escaneo
            </button>
          )}
        </div>
      )}

      {/* Animaciones */}
      <style>{`
        @keyframes scanline {
          0%   { top: 18%; }
          50%  { top: 78%; }
          100% { top: 18%; }
        }
        @keyframes pop {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
