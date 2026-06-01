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
import { api } from "@/lib/_shared/api-client";

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
  kind:        ScanKind;
  holderName:  string | null;
  typeName:    string | null;
  dniLast2:    string | null;
  boxLabel:    string | null;
  boxHostName: string | null;
  scannedAt:   string | null;
};

type Attendee = {
  ticketId:   string;
  qrCode:     string;
  status:     "active" | "used" | "void";
  holderName: string | null;
  dniLast2:   string | null;
  usedAt:     string | null;
  ticketType: string;
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

function toneFor(kind: ScanKind) {
  return kind === "valid" ? C.green : kind === "already_used" ? C.yellow : C.red;
}
function toneSoftFor(kind: ScanKind) {
  return kind === "valid" ? C.greenSoft : kind === "already_used" ? C.yellowSoft : C.redSoft;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ScanPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}

function Inner() {
  const scan      = useScanQr();
  const search    = useSearchParams();
  const eventSlug = search.get("event");
  const online    = useOnlineStatus();

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

  // ── Búsqueda por nombre/DNI ──────────────────────────────────────────────
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<Attendee[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef  = useRef<HTMLInputElement | null>(null);

  const openSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setSearchResults([]);
    setTimeout(() => inputRef.current?.focus(), 80);
  };
  const closeSearch = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  useEffect(() => {
    if (!searchOpen || !eventSlug || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get<Attendee[]>(
          `/api/events/${eventSlug}/attendees?q=${encodeURIComponent(searchQuery)}`
        );
        setSearchResults(res);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [searchQuery, searchOpen, eventSlug]);

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
    clearTimer.current = setTimeout(dismissResult, 3000);
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
      showResult({ kind: "invalid", holderName: null, typeName: "QR no reconocido", dniLast2: null, boxLabel: null, boxHostName: null, scannedAt: null });
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

  // Escanear desde búsqueda (escanea el QR del asistente encontrado)
  const scanFromSearch = useCallback(async (attendee: Attendee) => {
    closeSearch();
    await runScan(attendee.qrCode);
  }, [runScan]);

  // Auto-start
  useEffect(() => {
    void startCamera();
    return () => { stopCamera(); if (clearTimer.current) clearTimeout(clearTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync offline
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
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  const tone     = result ? toneFor(result.kind)     : C.purple;
  const toneSoft = result ? toneSoftFor(result.kind) : C.purpleSoft;

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: C.bg,
      display: "flex", flexDirection: "column",
      fontFamily: FONT_DISPLAY, color: C.text,
      paddingTop:    "env(safe-area-inset-top, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      userSelect: "none", WebkitUserSelect: "none",
    }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "12px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11, background: C.purple, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 4px 16px ${C.purpleEdge}`,
          }}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none"><path d="M7 1L13 7L7 13L1 7L7 1Z" fill="#fff"/></svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {ev?.title ?? "pasape"}
            </div>
            <div style={{ fontSize: 10, color: C.dimmer, letterSpacing: "0.03em" }}>Modo puerta</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {pendingCount > 0 && (
            <div style={{ padding: "3px 8px", borderRadius: 999, background: C.yellowSoft, fontSize: 10, fontWeight: 700, color: C.yellow }}>
              {pendingCount} pend.
            </div>
          )}
          <div style={{
            padding: "4px 10px", borderRadius: 999,
            background: online ? C.greenSoft : "rgba(255,255,255,0.06)",
            fontSize: 10, fontWeight: 700,
            color: online ? C.green : C.dimmer,
            display: "flex", alignItems: "center", gap: 5,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: online ? C.green : C.dimmer, boxShadow: online ? `0 0 6px ${C.green}` : "none", display: "inline-block" }}/>
            {online ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* ── VIEWFINDER ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "12px 18px", minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{
          flex: 1, position: "relative",
          borderRadius: 22, overflow: "hidden",
          background: C.bg2, border: `1px solid ${C.line}`,
          // Borde coloreado cuando hay resultado
          boxShadow: result ? `0 0 0 2px ${tone}` : "none",
          transition: "box-shadow 0.2s ease",
        }}>
          <video
            ref={videoRef}
            playsInline muted
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: active ? 1 : 0,
              transition: "opacity 0.3s ease",
            }}
          />

          {/* Idle placeholder */}
          {!active && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {cameraError ? (
                <>
                  <div style={{ fontSize: 13, color: C.dim, textAlign: "center", padding: "0 24px" }}>Sin acceso a cámara</div>
                  <button type="button" onClick={startCamera} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.line2}`, background: C.bg3, color: C.text, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Reintentar
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", gap: 5 }}>
                  {[0,1,2].map((i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: C.purple, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}/>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Scanline */}
          {active && !result && (
            <div style={{
              position: "absolute", left: "8%", right: "8%", height: 2, borderRadius: 999,
              background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`,
              boxShadow: `0 0 14px 4px ${C.green}55`,
              animation: "scanline 2.4s ease-in-out infinite",
            }}/>
          )}

          {/* Esquinas — cambian de color según resultado */}
          {(["tl","tr","bl","br"] as const).map((pos) => {
            const isR = pos.includes("r"), isB = pos.includes("b");
            return (
              <div key={pos} style={{
                position: "absolute",
                top:    isB ? undefined : 14, bottom: isB ? 14 : undefined,
                left:   isR ? undefined : 14, right:  isR ? 14 : undefined,
                width: 26, height: 26,
                borderTop:    !isB ? `2.5px solid ${tone}` : "none",
                borderBottom: isB  ? `2.5px solid ${tone}` : "none",
                borderLeft:   !isR ? `2.5px solid ${tone}` : "none",
                borderRight:  isR  ? `2.5px solid ${tone}` : "none",
                transition: "border-color 0.2s ease",
              }}/>
            );
          })}

          {/* Label inferior */}
          {active && !result && (
            <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 12, color: C.dimmer, fontWeight: 500 }}>
              Apunta al código QR
            </div>
          )}
        </div>
      </div>

      {/* ── RESULTADO CARD (reemplaza botones cuando hay scan) ──────────── */}
      {result && (
        <div
          onClick={dismissResult}
          style={{ padding: "0 18px 10px", flexShrink: 0, cursor: "pointer" }}
        >
          <div style={{
            padding: "14px 16px",
            borderRadius: 18,
            background: toneSoft,
            border: `1.5px solid ${tone}44`,
            display: "flex", alignItems: "center", gap: 14,
            animation: "slideUp 220ms cubic-bezier(0.34,1.2,0.64,1)",
          }}>
            {/* Ícono */}
            <div style={{
              width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
              background: tone,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 20px ${tone}66`,
            }}>
              {result.kind === "valid" ? (
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 11l5 5 9-10" stroke={C.bg} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : result.kind === "already_used" ? (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="7" stroke={C.bg} strokeWidth="2"/>
                  <path d="M10 7v4l2.5 2" stroke={C.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke={C.bg} strokeWidth="2.8" strokeLinecap="round"/>
                </svg>
              )}
            </div>

            {/* Texto principal */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {result.kind === "valid"
                  ? (result.holderName ?? "Entrada válida")
                  : result.kind === "already_used"
                    ? `Ya ingresó${result.scannedAt ? ` · ${fmtTime(result.scannedAt)}` : ""}`
                    : "QR inválido"}
              </div>
              <div style={{ marginTop: 3, fontSize: 13, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {result.kind === "valid"
                  ? [result.typeName, result.boxLabel ? `Box ${result.boxLabel}` : null, result.dniLast2 ? `DNI ··${result.dniLast2}` : null].filter(Boolean).join("  ·  ")
                  : result.kind === "already_used"
                    ? (result.holderName ?? "")
                    : (result.typeName ?? "QR no pertenece a este evento")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTONES (siempre visibles, debajo de la card) ───────────────── */}
      {!result && (
        <div style={{ padding: "0 18px calc(env(safe-area-inset-bottom, 0px) + 16px)", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {/* Estado de escaneo o botón de inicio */}
          {active ? (
            <div style={{ height: 50, borderRadius: 14, background: C.bg2, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: C.green, boxShadow: `0 0 8px ${C.green}`, display: "inline-block", animation: "pulse 1.4s ease-in-out infinite" }}/>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.dim }}>Escaneando…</span>
            </div>
          ) : (
            <button type="button" onClick={startCamera} style={{
              height: 52, borderRadius: 16, border: 0, background: C.purple, color: C.text,
              fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 9, cursor: "pointer",
              boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 10px 28px -8px ${C.purpleEdge}`,
            }}>
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <rect x="12" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <rect x="1" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
                <circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              Iniciar escaneo
            </button>
          )}

          {/* Buscar por nombre o DNI */}
          <button type="button" onClick={openSearch} style={{
            height: 44, borderRadius: 13, border: `1px solid ${C.line2}`,
            background: "rgba(255,255,255,0.04)", color: C.dim,
            fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
          }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Buscar por nombre o DNI
          </button>
        </div>
      )}

      {/* Botón de búsqueda también visible cuando hay resultado */}
      {result && (
        <div style={{ padding: "0 18px calc(env(safe-area-inset-bottom, 0px) + 16px)", flexShrink: 0 }}>
          <button type="button" onClick={openSearch} style={{
            width: "100%", height: 44, borderRadius: 13, border: `1px solid ${C.line2}`,
            background: "rgba(255,255,255,0.04)", color: C.dim,
            fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer",
          }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Buscar por nombre o DNI
          </button>
        </div>
      )}

      {/* ── BÚSQUEDA (bottom sheet) ─────────────────────────────────────── */}
      {searchOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeSearch}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 30, backdropFilter: "blur(4px)" }}
          />
          {/* Sheet */}
          <div style={{
            position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
            background: C.bg2,
            borderRadius: "22px 22px 0 0",
            border: `1px solid ${C.line}`,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            maxHeight: "80dvh",
            display: "flex", flexDirection: "column",
            animation: "slideUp 240ms cubic-bezier(0.34,1.1,0.64,1)",
          }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line2 }}/>
            </div>

            {/* Header del sheet */}
            <div style={{ padding: "0 18px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>Buscar asistente</div>
              <button type="button" onClick={closeSearch} style={{ width: 30, height: 30, borderRadius: 999, background: C.bg3, border: "none", color: C.dim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              </button>
            </div>

            {/* Input de búsqueda */}
            <div style={{ padding: "0 18px 12px" }}>
              <div style={{ position: "relative" }}>
                <svg width="16" height="16" viewBox="0 0 15 15" fill="none" style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: C.dim, pointerEvents: "none" }}>
                  <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nombre o últimos dígitos del DNI"
                  autoComplete="off"
                  style={{
                    width: "100%", height: 48, borderRadius: 14, border: `1px solid ${C.line2}`,
                    background: C.bg3, color: C.text,
                    fontFamily: FONT_DISPLAY, fontSize: 15,
                    paddingLeft: 42, paddingRight: 14,
                    outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            {/* Resultados */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 18px" }}>
              {searchLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0,1,2].map((i) => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: C.purple, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}/>
                    ))}
                  </div>
                </div>
              ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center", fontSize: 14, color: C.dimmer }}>
                  Sin resultados para "{searchQuery}"
                </div>
              ) : searchQuery.length < 2 ? (
                <div style={{ padding: "16px 0", textAlign: "center", fontSize: 13, color: C.dimmer }}>
                  Escribe al menos 2 caracteres
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {searchResults.map((attendee) => (
                    <button
                      key={attendee.ticketId}
                      type="button"
                      onClick={() => void scanFromSearch(attendee)}
                      style={{
                        width: "100%", padding: "12px 14px", borderRadius: 14,
                        border: `1px solid ${attendee.status === "used" ? C.line : C.line2}`,
                        background: attendee.status === "used" ? C.bg3 : C.bg2,
                        color: C.text,
                        fontFamily: FONT_DISPLAY,
                        display: "flex", alignItems: "center", gap: 12,
                        cursor: "pointer", textAlign: "left",
                        opacity: attendee.status === "used" ? 0.7 : 1,
                      }}
                    >
                      {/* Status badge */}
                      <div style={{
                        width: 10, height: 10, borderRadius: 999, flexShrink: 0,
                        background: attendee.status === "active" ? C.green : attendee.status === "used" ? C.yellow : C.red,
                        boxShadow: `0 0 6px ${attendee.status === "active" ? C.green : attendee.status === "used" ? C.yellow : C.red}`,
                      }}/>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {attendee.holderName ?? "Sin nombre"}
                        </div>
                        <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                          {attendee.ticketType}
                          {attendee.dniLast2 ? ` · DNI ··${attendee.dniLast2}` : ""}
                          {attendee.status === "used" && attendee.usedAt ? ` · Ingresó ${fmtTime(attendee.usedAt)}` : ""}
                        </div>
                      </div>

                      {/* Acción */}
                      <div style={{
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
                        padding: "4px 10px", borderRadius: 8, flexShrink: 0,
                        background: attendee.status === "active" ? C.purpleSoft : C.bg3,
                        color: attendee.status === "active" ? C.purple : C.dim,
                        textTransform: "uppercase",
                      }}>
                        {attendee.status === "active" ? "Validar" : attendee.status === "used" ? "Ya ingresó" : "Anulada"}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Animaciones */}
      <style>{`
        @keyframes scanline {
          0%   { top: 18%; }
          50%  { top: 78%; }
          100% { top: 18%; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
