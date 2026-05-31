"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { C, FONT_DISPLAY, Phone, QrSquare } from "@/components/design";
import { useScanQr } from "@/lib/scanning/hooks/useScanQr";
import { refreshScanCache } from "@/lib/scanning/scanCache";
import { useOnlineStatus } from "@/lib/_shared/useOnlineStatus";
import { scanLocal } from "@/lib/scanning/scanLocal";
import { countPending } from "@/lib/scanning/scanQueue";
import { syncPending } from "@/lib/scanning/syncWorker";

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="7" cy="7" r="5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" />
    <path d="M11 11l4 4" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const Dot = ({ color }: { color: string }) => (
  <span style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}`, display: "inline-block" }} />
);

type ScanKind = "valid" | "already_used" | "invalid";

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

export default function ScanPage() {
  const scan = useScanQr();
  const search = useSearchParams();
  const eventSlug = search.get("event");
  const online = useOnlineStatus();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<string>("");
  const [lastCode, setLastCode] = useState("");
  const [active, setActive] = useState(false);
  const [supported] = useState<boolean | null>(() => {
    if (typeof window === "undefined") return null;
    return !!getDetector();
  });
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [overlay, setOverlay] = useState<{
    kind: ScanKind;
    holder: string | null;
    typeName: string | null;
    dniLast2: string | null;
    boxLabel: string | null;
    boxHostName: string | null;
    boxFilled: number | null;
    boxCapacity: number | null;
  } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const runScan = useCallback(
    async (code: string) => {
      if (!code || code === lastCodeRef.current) return;
      lastCodeRef.current = code;
      setLastCode(code);
      try {
        const result = online ? await scan.mutateAsync(code) : await scanLocal(code);
        setOverlay({
          kind: (result.kind as ScanKind) ?? "invalid",
          holder: result.holderName ?? null,
          typeName: result.ticketTypeName ?? null,
          dniLast2: result.holderDniLast2 ?? null,
          boxLabel: result.boxLabel ?? null,
          boxHostName: result.boxHostName ?? null,
          boxFilled: result.boxFilled ?? null,
          boxCapacity: result.boxCapacity ?? null,
        });
      } catch (e) {
        setOverlay({
          kind: "invalid",
          holder: null,
          typeName: (e as Error).message,
          dniLast2: null,
          boxLabel: null,
          boxHostName: null,
          boxFilled: null,
          boxCapacity: null,
        });
      }
      setTimeout(() => {
        setOverlay(null);
        lastCodeRef.current = "";
        setLastCode("");
      }, 2200);
    },
    [scan, online],
  );

  const loop = useCallback(
    async function scanLoop(detector: DetectorLike) {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(() => {
          void scanLoop(detector);
        });
        return;
      }
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) await runScan(codes[0].rawValue);
      } catch {}
      rafRef.current = requestAnimationFrame(() => {
        void scanLoop(detector);
      });
    },
    [runScan],
  );

  const startCamera = useCallback(async () => {
    setError(null);
    const detector = getDetector();
    if (!detector) {
      setError("Tu navegador no soporta cámara. Usa la subida de imagen.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      rafRef.current = requestAnimationFrame(() => loop(detector));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [loop]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    if (!eventSlug) return;
    let cancel = false;
    const sync = () => refreshScanCache(eventSlug).catch(() => {});
    void sync();
    const id = setInterval(() => {
      if (!cancel && navigator.onLine) void sync();
    }, 60_000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, [eventSlug]);

  useEffect(() => {
    let cancel = false;
    const refresh = async () => {
      if (!cancel) setPendingCount(await countPending());
    };
    void refresh();
    const id = setInterval(refresh, 2000);
    return () => {
      cancel = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!online || !eventSlug) return;
    void syncPending(eventSlug).then(() => {
      void (async () => setPendingCount(await countPending()))();
    });
  }, [online, eventSlug]);

  const onFile = async (file: File) => {
    const detector = getDetector();
    if (!detector) {
      setError("Tu navegador no soporta lectura de QR.");
      return;
    }
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    if (codes[0]?.rawValue) await runScan(codes[0].rawValue);
    else setError("No se detectó un QR en la imagen.");
  };

  // SCAN VALID / INVALID overlays
  if (overlay) {
    const isValid = overlay.kind === "valid";
    const tone = isValid ? C.green : C.red;
    return (
      <Phone>
        <div style={{ position: "absolute", inset: 0, background: "#000" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: isValid
                ? "radial-gradient(80% 60% at 50% 40%, #1a1620 0%, #050507 70%)"
                : "radial-gradient(80% 60% at 50% 40%, #2a1518 0%, #050507 70%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.3,
              backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 12px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 260,
              height: 260,
            }}
          >
            {[0, 1, 2, 3].map((i) => {
              const r =
                i === 0
                  ? { top: 0, left: 0 }
                  : i === 1
                    ? { top: 0, right: 0 }
                    : i === 2
                      ? { bottom: 0, left: 0 }
                      : { bottom: 0, right: 0 };
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 36,
                    height: 36,
                    ...r,
                    borderTop: "top" in r ? `3px solid ${tone}` : "none",
                    borderBottom: "bottom" in r ? `3px solid ${tone}` : "none",
                    borderLeft: "left" in r ? `3px solid ${tone}` : "none",
                    borderRight: "right" in r ? `3px solid ${tone}` : "none",
                  }}
                />
              );
            })}
            <div style={{ position: "absolute", inset: 30, opacity: 0.4 }}>
              <QrSquare code={lastCode || "x"} size={200} />
            </div>
          </div>

          {isValid && overlay.boxLabel && (
            <div
              style={{
                position: "absolute",
                top: 22,
                left: 22,
                padding: "10px 14px",
                borderRadius: 16,
                background: "rgba(34,209,127,0.18)",
                backdropFilter: "blur(20px)",
                boxShadow: `0 0 0 1.5px ${C.green} inset, 0 14px 36px rgba(34,209,127,0.35)`,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxWidth: 220,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 700,
                  fontSize: 22,
                  letterSpacing: "-0.01em",
                  color: "#fff",
                  lineHeight: 1.05,
                }}
              >
                BOX {overlay.boxLabel}
              </div>
              {overlay.holder && (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {overlay.holder}
                </div>
              )}
              {overlay.boxHostName && overlay.boxHostName !== overlay.holder && (
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
                  invitad@ por {overlay.boxHostName}
                </div>
              )}
              {overlay.boxCapacity != null && (
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.green,
                    letterSpacing: "0.04em",
                  }}
                >
                  {overlay.boxFilled ?? 0}/{overlay.boxCapacity} dentro
                </div>
              )}
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 60,
              left: 22,
              right: 22,
              padding: "18px 20px",
              borderRadius: 22,
              background: isValid ? "rgba(34,209,127,0.18)" : "rgba(255,77,94,0.2)",
              backdropFilter: "blur(20px)",
              boxShadow: `0 0 0 1.5px ${tone} inset, 0 20px 60px ${tone}44`,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: tone,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 20px ${tone}`,
              }}
            >
              {isValid ? (
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <path d="M4 11l5 5 9-11" stroke="#062315" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20">
                  <path d="M5 5l10 10M15 5L5 15" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
                {isValid
                  ? overlay.holder ?? "Entrada válida"
                  : overlay.kind === "already_used"
                    ? "Ya ingresó antes"
                    : "QR inválido"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
                {overlay.typeName ?? (isValid ? "Entrada confirmada" : "No dejes pasar")}
              </div>
              {isValid && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  {overlay.dniLast2 ? (
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.18)",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "JetBrains Mono, ui-monospace, monospace",
                        letterSpacing: "0.08em",
                      }}
                    >
                      DNI ··{overlay.dniLast2}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(255,206,59,0.22)",
                        color: "#FFCE3B",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.04em",
                      }}
                    >
                      ⚠ SIN DNI · pide ID
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </Phone>
    );
  }

  // SCAN HOME
  return (
    <Phone>
      <div style={{ padding: "10px 22px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: C.purple,
              boxShadow: "0 0 0 1px rgba(255,255,255,0.12) inset, 0 6px 18px -4px rgba(124,58,237,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 7L7 13L1 7L7 1Z" fill="#fff" />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              pasape
            </div>
            <div style={{ fontSize: 10, color: C.dim, letterSpacing: "0.04em" }}>Modo puerta</div>
          </div>
        </div>
        <div
          style={{
            padding: "5px 10px",
            borderRadius: 999,
            background:
              !online
                ? "rgba(217, 119, 6, 0.15)"
                : pendingCount > 0
                  ? "rgba(59, 130, 246, 0.15)"
                  : C.greenSoft,
            fontSize: 10,
            fontWeight: 700,
            color: !online ? "#D97706" : pendingCount > 0 ? "#3B82F6" : C.green,
            display: "flex",
            alignItems: "center",
            gap: 5,
            letterSpacing: "0.04em",
          }}
        >
          <Dot color={!online ? "#D97706" : pendingCount > 0 ? "#3B82F6" : C.green} />
          {!online ? "Sin red" : pendingCount > 0 ? `Sincronizando ${pendingCount}` : "En línea"}
        </div>
      </div>

      <div style={{ padding: "22px 22px 0" }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.95 }}>
          Escanea<br />una entrada.
        </div>
        <div style={{ fontSize: 13, color: C.dim, marginTop: 8 }}>
          {supported === false
            ? "Tu navegador no soporta cámara · sube una imagen del QR."
            : active
              ? "Apunta al QR — se valida solo."
              : "Pulsa iniciar para activar la cámara."}
        </div>
      </div>

      <div style={{ flex: 1, padding: "20px 22px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "relative", aspectRatio: "1", maxWidth: 280, margin: "0 auto", width: "100%", overflow: "hidden", borderRadius: 18 }}>
          {active && (
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
            />
          )}
          {!active && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.02)", borderRadius: 18 }} />
          )}
          {[
            { top: 0, left: 0 },
            { top: 0, right: 0 },
            { bottom: 0, left: 0 },
            { bottom: 0, right: 0 },
          ].map((pos, i) => {
            const isRight = "right" in pos;
            const isBottom = "bottom" in pos;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  ...pos,
                  width: 28,
                  height: 28,
                  borderTop: isBottom ? "none" : "2.5px solid rgba(124,58,237,0.7)",
                  borderBottom: isBottom ? "2.5px solid rgba(124,58,237,0.7)" : "none",
                  borderLeft: isRight ? "none" : "2.5px solid rgba(124,58,237,0.7)",
                  borderRight: isRight ? "2.5px solid rgba(124,58,237,0.7)" : "none",
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              height: 2,
              background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.8), rgba(124,58,237,0.9), rgba(124,58,237,0.8), transparent)",
              borderRadius: 999,
              top: "40%",
              boxShadow: "0 0 12px 2px rgba(124,58,237,0.5)",
            }}
          />
        </div>

        {error && (
          <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 12, background: C.redSoft, color: C.red, fontSize: 12 }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 16, width: "100%" }}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && manual) runScan(manual);
            }}
            placeholder="o pega el código del QR"
            style={{
              width: "100%",
              height: 46,
              borderRadius: 12,
              padding: "0 14px",
              background: "rgba(255,255,255,0.04)",
              boxShadow: `0 0 0 1px ${C.line} inset`,
              border: 0,
              color: "#fff",
              fontFamily: "JetBrains Mono, ui-monospace, monospace",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>
      </div>

      <div style={{ padding: "20px 22px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={active ? stopCamera : startCamera}
          style={{
            height: 62,
            borderRadius: 18,
            border: 0,
            background: C.purple,
            color: "#fff",
            fontFamily: FONT_DISPLAY,
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            cursor: "pointer",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 32px -8px rgba(124,58,237,0.65)",
          }}
        >
          {active ? "Detener escaneo" : "Iniciar escaneo"}
        </button>
        <label
          style={{
            height: 50,
            borderRadius: 16,
            background: "rgba(255,255,255,0.06)",
            color: C.dim,
            fontFamily: FONT_DISPLAY,
            fontSize: 14,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            cursor: "pointer",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.09) inset",
          }}
        >
          <SearchIcon />
          Subir imagen del QR
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </Phone>
  );
}
