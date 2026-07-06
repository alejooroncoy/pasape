// Pantalla de escaneo del portero — port SPA (Vite/Capacitor) de
// `src/app/[locale]/scan/page.tsx`. Cambios vs. el original Next:
//   - Sin "use client" / next/navigation: `eventSlug` llega por prop (el router
//     de App.tsx lo lee de URLSearchParams).
//   - Tokens importados directo desde `@/components/design/tokens` (no del
//     barrel index, que arrastra componentes con deps de Next/imagenes).
//   - Sin useScanRealtime/useRealtimeEventStats (Supabase Realtime): el portero
//     se autentica por token, no tiene sesion Supabase. Las stats se refrescan
//     por polling de React Query (refetch cada 30s).
//   - <img> del logo -> emoji, para no depender de assets de Next.
import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT_DISPLAY } from "@/components/design/tokens";
import { Logo } from "@/components/brand/Logo";
import { useScanQr } from "@/lib/scanning/hooks/useScanQr";
import { refreshScanCache, searchCachedTickets } from "@/lib/scanning/scanCache";
import { useOnlineStatus } from "@/lib/_shared/hooks/useOnlineStatus";
import { scanLocal, admitLocal } from "@/lib/scanning/scanLocal";
import { countPending } from "@/lib/scanning/scanQueue";
import { syncPending } from "@/lib/scanning/syncWorker";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useEventStats } from "@/lib/events/hooks/useEventStats";
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
  dniLast4:    string | null;
  boxLabel:    string | null;
  boxHostName: string | null;
  boxFilled:   number | null;
  boxCapacity: number | null;
  scannedAt:   string | null;
};

type Attendee = {
  ticketId:   string;
  status:     "active" | "used" | "void";
  holderName: string | null;
  dniLast4:   string | null;
  usedAt:     string | null;
  ticketType: string;
};

type DetectorLike = {
  detect: (src: CanvasImageSource | ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

// Decodificador unificado. SIEMPRE recorta el ROI central (~70% del lado menor,
// donde está el viewfinder) a un canvas chico (~640px) y decodifica ESO, no el
// frame completo: un frame de 1080p tarda ~50ms en decodificar; el recorte a 640
// baja a ~10-15ms. Usa BarcodeDetector NATIVO si existe (mucho más robusto con QR
// borroso/inclinado); si no, jsQR sobre el mismo canvas.
const ROI_TARGET = 640;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDetector(): DetectorLike | null {
  if (typeof window === "undefined") return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor = (window as any).BarcodeDetector;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let native: any = null;
  if (Ctor) {
    try { native = new Ctor({ formats: ["qr_code"] }); console.warn("[bench] detector = BarcodeDetector NATIVO"); } catch { /* fallback */ }
  }
  let jsQRmod: typeof import("jsqr").default | null = null;
  if (!native) {
    console.warn("[bench] detector = jsQR (fallback)");
    void import("jsqr").then((m) => { jsQRmod = m.default; });
  }
  return {
    async detect(src) {
      const video = src as HTMLVideoElement;
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) return [];
      if (native) {
        // El nativo está optimizado para el <video> directo (GPU). Pasarle un
        // canvas 2D lo DUPLICABA el tiempo de decode → se lo damos crudo.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const codes = await native.detect(video);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return codes.map((c: any) => ({ rawValue: c.rawValue as string }));
      }
      // Fallback jsQR: SÍ conviene recortar el ROI central a un canvas chico.
      if (!ctx || !jsQRmod) return [];
      const roi = Math.round(Math.min(vw, vh) * 0.7);
      const sx = Math.round((vw - roi) / 2), sy = Math.round((vh - roi) / 2);
      const target = Math.min(ROI_TARGET, roi);
      canvas.width = target; canvas.height = target;
      ctx.drawImage(video, sx, sy, roi, roi, 0, 0, target, target);
      const img = ctx.getImageData(0, 0, target, target);
      const res = jsQRmod(img.data, target, target, { inversionAttempts: "dontInvert" });
      return res?.data ? [{ rawValue: res.data }] : [];
    },
  };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}
function toneFor(kind: ScanKind)     { return kind === "valid" ? C.green  : kind === "already_used" ? C.yellow : C.red; }
function toneSoftFor(kind: ScanKind) { return kind === "valid" ? C.greenSoft : kind === "already_used" ? C.yellowSoft : C.redSoft; }

export function ScanScreen({ eventSlug }: { eventSlug: string }) {
  const scan      = useScanQr(eventSlug);
  const online    = useOnlineStatus();

  const { data: eventData } = useEvent(eventSlug);
  const { data: statsData, refetch: statsRefetch } = useEventStats(eventSlug);
  const ev        = eventData?.event;
  // Sin Supabase Realtime: stats por polling ligero (el portero por token no
  // tiene sesion Supabase). El scan en vivo ya actualiza la UI local.
  useEffect(() => {
    if (!eventSlug) return;
    const id = setInterval(() => { if (navigator.onLine) void statsRefetch(); }, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventSlug]);

  const validated = statsData?.validated ?? 0;
  const capacity  = statsData?.capacity  ?? 0;
  const aforo     = capacity > 0 ? Math.round((validated / capacity) * 100) : 0;

  // Desktop detection
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Refs de cámara
  const videoRef    = useRef<HTMLVideoElement | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const lastCodeRef = useRef("");
  const lastDetectRef = useRef(0);
  const clearTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mientras se muestra un resultado, pausamos la detección: el QR rota cada 10s,
  // así que sin pausa el resultado en pantalla cambiaría solo. El portero avanza
  // con el botón "Siguiente".
  const scanPausedRef = useRef(false);

  // ── Benchmark de reconocimiento ──────────────────────────────────────────
  // resumeAtRef: cuándo empezó a buscar (cámara lista o tras "Siguiente").
  // Medimos el wall-clock hasta detectar el primer QR + cuántos intentos de
  // decode y el promedio de decode (para separar "enfoque/posición" de "decode").
  const resumeAtRef = useRef<number | null>(null);
  const attemptsRef = useRef(0);
  const decodeSumRef = useRef(0);
  const [bench, setBench] = useState<{ ms: number; attempts: number; decodeMs: number } | null>(null);

  const [active,       setActive]       = useState(false);
  const [cameraError,  setCameraError]  = useState(false);
  const [result,       setResult]       = useState<ScanResult | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // ── Lista de asistentes (web) ────────────────────────────────────────────
  const [attendees,     setAttendees]     = useState<Attendee[]>([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mobile search sheet
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const loadAttendees = useCallback(async (q = "") => {
    if (!eventSlug) return;
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setAttendees([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);

    try {
      const local = await searchCachedTickets(trimmed);
      if (local.length > 0) {
        setAttendees(local.map((t) => ({
          ticketId:   t.ticketId,
          status:     t.status === "refunded" ? "void" : t.status,
          holderName: t.holderName,
          dniLast4:   t.holderDniLast4,
          usedAt:     null,
          ticketType: t.ticketTypeName,
        })));
        setSearchLoading(false);
        if (!online) return;
      }
    } catch { /* cache vacío → servidor */ }

    if (!online) { setSearchLoading(false); return; }
    try {
      const res = await api.get<Attendee[]>(
        `/api/events/${eventSlug}/attendees?q=${encodeURIComponent(trimmed)}`
      );
      setAttendees(res);
    } catch { /* offline u error */ }
    finally { setSearchLoading(false); }
  }, [eventSlug, online]);

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.length < 2) {
      setAttendees([]);
      return;
    }
    searchDebounce.current = setTimeout(() => void loadAttendees(searchQuery), 300);
  }, [searchQuery, loadAttendees]);

  // Mobile search sheet open
  const openMobileSearch = () => {
    setSearchOpen(true);
    setSearchQuery("");
    setAttendees([]);
    setTimeout(() => mobileInputRef.current?.focus(), 80);
  };
  const closeMobileSearch = () => { setSearchOpen(false); setSearchQuery(""); setAttendees([]); };

  // ── Cámara ───────────────────────────────────────────────────────────────
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
    scanPausedRef.current = false; // reanudar la detección
    // Reinicia el cronómetro de benchmark: empieza a contar para el próximo QR.
    resumeAtRef.current = performance.now();
    attemptsRef.current = 0;
    decodeSumRef.current = 0;
    setMeasuring(false);
  }, []);

  // BENCHMARK manual: el portero toca esto JUSTO cuando ve el QR en cámara → mide
  // el tiempo real "QR visible → reconocido" (aísla el posicionamiento humano).
  const [measuring, setMeasuring] = useState(false);
  const markQrVisible = useCallback(() => {
    resumeAtRef.current = performance.now();
    attemptsRef.current = 0;
    decodeSumRef.current = 0;
    setBench(null);
    setMeasuring(true);
  }, []);

  // DEBUG: captura el frame de cámara actual (lo que ve el decodificador) y lo
  // sube al sink local (adb reverse :4600) para inspeccionar nitidez/encuadre.
  const [captured, setCaptured] = useState(0);
  const captureFrame = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL("image/jpeg", 0.7);
    try {
      await fetch("http://localhost:4600/f", { method: "POST", body: dataUrl });
      setCaptured((n) => n + 1);
    } catch { /* sink no disponible */ }
  }, []);

  const showResult = useCallback((r: ScanResult) => {
    setResult(r);
    haptic(r.kind);
    // El resultado SE QUEDA hasta que el portero toque "Siguiente": pausamos la
    // detección para que el QR rotativo no lo reemplace mientras lo lee.
    scanPausedRef.current = true;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    // Actualizar lista de asistentes
    if (r.holderName) {
      setAttendees((prev) => prev.map((a) =>
        a.holderName === r.holderName && r.kind === "valid"
          ? { ...a, status: "used", usedAt: r.scannedAt ?? new Date().toISOString() }
          : a
      ));
    }
  }, [dismissResult]);

  const runScan = useCallback(async (code: string) => {
    if (!code || code === lastCodeRef.current) return;
    lastCodeRef.current = code;
    try {
      // LOCAL-FIRST: validación offline contra el cache firmado, instantánea (sin
      // round-trip al server, que en la puerta se sentía como ~4s). El envío al
      // server (fuente de verdad + dedup multi-puerta) va por la cola en segundo
      // plano. Solo si el ticket NO está en el cache (bad_cert) y hay red caemos
      // al server, que sí conoce tickets recién comprados.
      const local = await scanLocal(code);
      if (local.kind === "invalid" && local.reason === "bad_cert" && online) {
        const raw = await scan.mutateAsync(code);
        showResult({
          kind:        (raw.kind as ScanKind) ?? "invalid",
          holderName:  raw.holderName ?? null,
          typeName:    raw.ticketTypeName ?? null,
          dniLast4:    raw.holderDniLast4 ?? null,
          boxLabel:    raw.boxLabel ?? null,
          boxHostName: raw.boxHostName ?? null,
          boxFilled:   raw.boxFilled ?? null,
          boxCapacity: raw.boxCapacity ?? null,
          scannedAt:   ("scannedAt" in raw ? raw.scannedAt : null) ?? null,
        });
        return;
      }
      showResult({
        kind:        local.kind,
        holderName:  local.holderName,
        typeName:    local.ticketTypeName,
        dniLast4:    local.holderDniLast4,
        boxLabel:    local.boxLabel,
        boxHostName: local.boxHostName,
        boxFilled:   local.boxFilled,
        boxCapacity: local.boxCapacity,
        scannedAt:   null,
      });
      if (online) void syncPending(eventSlug); // empuja la cola sin bloquear
    } catch {
      showResult({ kind: "invalid", holderName: null, typeName: "QR no reconocido", dniLast4: null, boxLabel: null, boxHostName: null, boxFilled: null, boxCapacity: null, scannedAt: null });
    }
  }, [scan, online, showResult, eventSlug]);

  // ~8fps de detección (no cada frame): en la puerta el QR se sostiene cientos de
  // ms, así que 8 intentos/seg son de sobra para engancharlo, y NO recalienta el
  // equipo (decodificar a 30-60fps sobre 720p frÍe gama baja). Clave para que
  // corra en celulares modestos sin throttling térmico.
  const DETECT_INTERVAL_MS = 120;
  const loop = useCallback(async function scanLoop(detector: DetectorLike) {
    const video = videoRef.current;
    if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(() => void scanLoop(detector)); return; }
    // Pausado mientras se muestra un resultado: no detectar (la cámara sigue viva
    // de fondo, pero el resultado en pantalla no se reemplaza hasta "Siguiente").
    if (scanPausedRef.current) { rafRef.current = requestAnimationFrame(() => void scanLoop(detector)); return; }
    const now = performance.now();
    if (now - lastDetectRef.current >= DETECT_INTERVAL_MS) {
      lastDetectRef.current = now;
      try {
        if (resumeAtRef.current == null) resumeAtRef.current = now; // primer intento del ciclo
        const t0 = performance.now();
        const codes = await detector.detect(video);
        decodeSumRef.current += performance.now() - t0;
        attemptsRef.current += 1;
        if (codes[0]?.rawValue) {
          // BENCHMARK: wall-clock desde que empezó a buscar hasta detectar el QR.
          if (resumeAtRef.current != null) {
            const ms = Math.round(performance.now() - resumeAtRef.current);
            const attempts = attemptsRef.current;
            const decodeMs = Math.round(decodeSumRef.current / Math.max(1, attempts));
            console.warn(`[bench] QR reconocido en ${ms}ms · ${attempts} intentos · decode prom ${decodeMs}ms`);
            setBench({ ms, attempts, decodeMs });
            setMeasuring(false);
            resumeAtRef.current = null; // congela hasta el próximo "Siguiente"
          }
          await runScan(codes[0].rawValue);
        }
      } catch {}
    }
    rafRef.current = requestAnimationFrame(() => void scanLoop(detector));
  }, [runScan]);

  const startCamera = useCallback(async () => {
    setCameraError(false);
    const detector = makeDetector();
    if (!detector) { setCameraError(true); return; }
    try {
      // 720p + autofocus continuo: resolución suficiente para leer QR a ~30cm
      // sin sobrecargar el decode, y enfoque que reacciona al acercar el código.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          // 720p: suficiente para leer el QR a ~30cm; el nativo decodifica rápido.
          width:  { ideal: 1280 },
          height: { ideal: 720 },
          // 24fps: el preview se ve fluido pero la cámara/ISP consume y calienta
          // menos que a 30. Suma con el throttle de detección para gama baja.
          frameRate: { ideal: 24, max: 30 },
        },
      });
      streamRef.current = stream;

      // Aplicar autofocus continuo (no todos los devices lo exponen → best-effort).
      const track = stream.getVideoTracks()[0];
      if (track) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const caps = track.getCapabilities?.() as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const advanced: any[] = [];
        if (caps?.focusMode?.includes?.("continuous")) advanced.push({ focusMode: "continuous" });
        if (advanced.length) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await track.applyConstraints({ advanced } as any).catch(() => {});
        }
      }

      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setActive(true);
      resumeAtRef.current = performance.now();
      attemptsRef.current = 0;
      decodeSumRef.current = 0;
      rafRef.current = requestAnimationFrame(() => loop(detector));
    } catch { setCameraError(true); }
  }, [loop]);

  // Alta manual desde la lista: admisión confiable por ticketId (no por QR
  // estático). El portero admite deliberadamente a quien buscó por nombre/DNI.
  const runAdmit = useCallback(async (attendee: Attendee) => {
    if (attendee.ticketId === lastCodeRef.current) return;
    lastCodeRef.current = attendee.ticketId;
    try {
      // El asistente viene del cache (búsqueda local) → admisión local-first
      // instantánea; el server se reconcilia por la cola en segundo plano.
      const raw = await admitLocal(attendee.ticketId);
      showResult({
        kind:        raw.kind,
        holderName:  raw.holderName ?? attendee.holderName ?? null,
        typeName:    raw.ticketTypeName ?? attendee.ticketType ?? null,
        dniLast4:    raw.holderDniLast4 ?? attendee.dniLast4 ?? null,
        boxLabel:    raw.boxLabel ?? null,
        boxHostName: raw.boxHostName ?? null,
        boxFilled:   raw.boxFilled ?? null,
        boxCapacity: raw.boxCapacity ?? null,
        scannedAt:   null,
      });
      if (online) void syncPending(eventSlug);
    } catch {
      showResult({ kind: "invalid", holderName: null, typeName: "No se pudo admitir", dniLast4: null, boxLabel: null, boxHostName: null, boxFilled: null, boxCapacity: null, scannedAt: null });
    }
  }, [online, showResult, eventSlug]);

  const scanFromList = useCallback(async (attendee: Attendee) => {
    if (searchOpen) closeMobileSearch();
    await runAdmit(attendee);
  }, [runAdmit, searchOpen]);

  useEffect(() => {
    void startCamera();
    return () => { stopCamera(); if (clearTimer.current) clearTimeout(clearTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync offline. Primer sync = snapshot completo (necesario para validar sin
  // red). Luego DELTA cada 5s (solo lo cambiado: transferencias, datos, uso,
  // altas) — barato y escala a eventos grandes. Full de respaldo cada ~90s por
  // si se perdió alguna actualización.
  useEffect(() => {
    if (!eventSlug) return;
    let cancel = false;
    let ticks = 0;
    void refreshScanCache(eventSlug, { full: true }).catch(() => {});
    const id = setInterval(() => {
      if (cancel || !navigator.onLine) return;
      ticks += 1;
      void refreshScanCache(eventSlug, { full: ticks % 18 === 0 }).catch(() => {});
    }, 5_000);
    // Reactivación de red: aprovechar ESE instante. En vez de esperar al tick de
    // 5s, sincronizamos delta apenas vuelve internet (el cursor `since` trae todo
    // lo acumulado durante el corte) y empujamos los scans encolados.
    const onOnline = () => {
      if (cancel) return;
      void refreshScanCache(eventSlug).catch(() => {});
      void syncPending(eventSlug).catch(() => {});
    };
    window.addEventListener("online", onOnline);
    return () => { cancel = true; clearInterval(id); window.removeEventListener("online", onOnline); };
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
  const tone     = result ? toneFor(result.kind)     : C.purple;
  const toneSoft = result ? toneSoftFor(result.kind) : C.purpleSoft;

  // ─── Viewfinder compartido ────────────────────────────────────────────────
  const ViewFinder = (
    <div style={{
      flex: 1, position: "relative",
      borderRadius: isDesktop ? 18 : 22,
      overflow: "hidden",
      background: C.bg2,
      border: `1px solid ${result ? tone + "55" : C.line}`,
      boxShadow: result ? `0 0 0 2px ${tone}33` : "none",
      transition: "border-color 0.2s, box-shadow 0.2s",
      minHeight: isDesktop ? 320 : 0,
    }}>
      <video ref={videoRef} playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: active ? 1 : 0, transition: "opacity 0.3s" }}/>

      {!active && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
          {cameraError ? (
            <>
              <div style={{ fontSize: 13, color: C.dim, textAlign: "center", padding: "0 24px" }}>Sin acceso a cámara</div>
              <button type="button" onClick={startCamera} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${C.line2}`, background: C.bg3, color: C.text, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Reintentar</button>
            </>
          ) : (
            <div style={{ display: "flex", gap: 5 }}>
              {[0,1,2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: C.purple, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}/>)}
            </div>
          )}
        </div>
      )}

      {active && !result && (
        <div style={{ position: "absolute", left: "8%", right: "8%", height: 2, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`, boxShadow: `0 0 14px 4px ${C.green}55`, animation: "scanline 2.4s ease-in-out infinite" }}/>
      )}

      {(["tl","tr","bl","br"] as const).map((pos) => {
        const isR = pos.includes("r"), isB = pos.includes("b");
        return (
          <div key={pos} style={{
            position: "absolute",
            top: isB ? undefined : 14, bottom: isB ? 14 : undefined,
            left: isR ? undefined : 14, right: isR ? 14 : undefined,
            width: 26, height: 26,
            borderTop:    !isB ? `2.5px solid ${tone}` : "none",
            borderBottom: isB  ? `2.5px solid ${tone}` : "none",
            borderLeft:   !isR ? `2.5px solid ${tone}` : "none",
            borderRight:  isR  ? `2.5px solid ${tone}` : "none",
            transition: "border-color 0.2s",
          }}/>
        );
      })}

      {active && !result && (
        <div style={{ position: "absolute", bottom: 14, left: 0, right: 0, textAlign: "center", fontSize: 12, color: C.dimmer, fontWeight: 500 }}>Apunta al código QR</div>
      )}
    </div>
  );

  // ─── Result card compartida ───────────────────────────────────────────────
  const ResultCard = result ? (
    <div onClick={dismissResult} style={{ cursor: "pointer", padding: isDesktop ? "0" : "0 18px 10px" }}>
      <div style={{ padding: "14px 16px", borderRadius: 16, background: toneSoft, border: `1.5px solid ${tone}44`, display: "flex", alignItems: "center", gap: 14, animation: "slideUp 220ms cubic-bezier(0.34,1.2,0.64,1)" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: tone, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${tone}66` }}>
          {result.kind === "valid" ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-10" stroke={C.bg} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : result.kind === "already_used" ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7" stroke={C.bg} strokeWidth="2"/><path d="M10 7v4l2.5 2" stroke={C.bg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke={C.bg} strokeWidth="2.8" strokeLinecap="round"/></svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {result.kind === "valid" ? (result.holderName ?? "Entrada válida") : result.kind === "already_used" ? `Ya ingresó${result.scannedAt ? ` · ${fmtTime(result.scannedAt)}` : ""}` : "QR inválido"}
          </div>
          <div style={{ marginTop: 3, fontSize: 13, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {result.kind === "valid" ? [result.boxLabel ? `Box ${result.boxLabel}` : result.typeName, result.boxLabel && result.boxCapacity ? `${result.boxFilled ?? 0}/${result.boxCapacity}` : null, result.dniLast4 ? `DNI ··${result.dniLast4}` : null].filter(Boolean).join("  ·  ")
              : result.kind === "already_used" ? (result.holderName ?? "") : (result.typeName ?? "QR no pertenece a este evento")}
          </div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, padding: "6px 12px", borderRadius: 999, border: `1px solid ${tone}55`, color: tone }}>Siguiente ›</div>
      </div>
    </div>
  ) : null;

  // ─── Lista de asistentes ──────────────────────────────────────────────────
  const AttendeeList = (isDesktop: boolean, compact = false) => (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: compact ? 6 : 8 }}>
      {searchLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0,1,2].map((i) => <div key={i} style={{ width: 5, height: 5, borderRadius: 999, background: C.purple, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}/>)}
          </div>
        </div>
      ) : attendees.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: C.dimmer }}>
          {searchQuery.length >= 2 ? `Sin resultados para "${searchQuery}"` : searchQuery.length > 0 ? "Escribe al menos 2 caracteres" : !eventSlug ? "Sin evento seleccionado" : "Sin asistentes"}
        </div>
      ) : (
        attendees.map((a) => (
          <button key={a.ticketId} type="button" onClick={() => void scanFromList(a)} style={{
            width: "100%", padding: compact ? "10px 12px" : "12px 14px",
            borderRadius: 14, border: `1px solid ${a.status === "used" ? C.line : C.line2}`,
            background: a.status === "used" ? C.bg3 : "rgba(255,255,255,0.03)",
            color: C.text, fontFamily: FONT_DISPLAY,
            display: "flex", alignItems: "center", gap: 10,
            cursor: "pointer", textAlign: "left",
            opacity: a.status === "used" ? 0.65 : 1,
            transition: "opacity 0.2s",
          }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, flexShrink: 0, background: a.status === "active" ? C.green : a.status === "used" ? C.yellow : C.red, boxShadow: `0 0 6px ${a.status === "active" ? C.green : a.status === "used" ? C.yellow : C.red}` }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: compact ? 13 : 14, fontWeight: 700, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.holderName ?? "—"}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>
                {a.ticketType}{a.dniLast4 ? ` · ··${a.dniLast4}` : ""}
                {a.status === "used" && a.usedAt ? ` · ${fmtTime(a.usedAt)}` : ""}
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", padding: "3px 9px", borderRadius: 8, flexShrink: 0, background: a.status === "active" ? C.purpleSoft : "rgba(255,255,255,0.04)", color: a.status === "active" ? C.purple : C.dimmer, textTransform: "uppercase" }}>
              {a.status === "active" ? "Validar" : a.status === "used" ? "Ingresó" : "Anulada"}
            </span>
          </button>
        ))
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT DESKTOP (≥768px)
  // ─────────────────────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ position: "fixed", inset: 0, background: C.bg, display: "flex", flexDirection: "column", fontFamily: FONT_DISPLAY, color: C.text }}>
        {/* Header */}
        <div style={{ height: 56, borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 14px ${C.purpleEdge}`, overflow: "hidden" }}>
              <Logo style={{ width: 18, height: 18 }} />
            </div>
            <div>
              <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em" }}>pasape</span>
              <span style={{ fontSize: 13, color: C.dim, marginLeft: 8 }}>·</span>
              <span style={{ fontSize: 13, color: C.dim, marginLeft: 8 }}>{ev?.title ?? "Modo portero"}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {pendingCount > 0 && <div style={{ padding: "3px 8px", borderRadius: 999, background: C.yellowSoft, fontSize: 11, fontWeight: 700, color: C.yellow }}>{pendingCount} pendientes</div>}
            <div style={{ padding: "4px 12px", borderRadius: 999, background: online ? C.greenSoft : "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 700, color: online ? C.green : C.dimmer, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: online ? C.green : C.dimmer, boxShadow: online ? `0 0 6px ${C.green}` : "none", display: "inline-block" }}/>
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </div>

        {/* Body 2 columnas */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, minHeight: 0, overflow: "hidden" }}>

          {/* ── Columna izquierda: cámara + resultado ───────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "20px 16px 20px 24px", borderRight: `1px solid ${C.line}`, overflow: "hidden" }}>
            {/* Viewfinder */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {ViewFinder}
            </div>

            {/* Resultado o estado */}
            {result ? ResultCard : (
              <div style={{ height: 50, borderRadius: 13, background: C.bg2, border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {active ? (
                  <><span style={{ width: 8, height: 8, borderRadius: 999, background: C.green, boxShadow: `0 0 8px ${C.green}`, display: "inline-block", animation: "pulse 1.4s ease-in-out infinite" }}/><span style={{ fontSize: 13, fontWeight: 600, color: C.dim }}>Escaneando…</span></>
                ) : (
                  <button type="button" onClick={startCamera} style={{ background: "none", border: "none", color: C.dim, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Iniciar cámara</button>
                )}
              </div>
            )}
          </div>

          {/* ── Columna derecha: stats + búsqueda + lista ───────────────── */}
          <div style={{ display: "flex", flexDirection: "column", padding: "20px 24px 20px 16px", gap: 14, overflow: "hidden" }}>

            {/* Stats */}
            {capacity > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, flexShrink: 0 }}>
                <div style={{ padding: "12px 16px", borderRadius: 14, background: C.bg2, border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmer, textTransform: "uppercase", marginBottom: 4 }}>Ingresadas</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>
                    {validated} <span style={{ fontSize: 13, fontWeight: 500, color: C.dim }}>/ {capacity}</span>
                  </div>
                </div>
                <div style={{ padding: "12px 16px", borderRadius: 14, background: C.bg2, border: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmer, textTransform: "uppercase", marginBottom: 4 }}>Aforo</div>
                  <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: aforo >= 90 ? C.red : aforo >= 70 ? C.yellow : C.green }}>
                    {aforo}%
                  </div>
                </div>
              </div>
            )}

            {/* Search input */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: C.dim, pointerEvents: "none" }}>
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nombre o DNI…"
                autoComplete="off"
                style={{ width: "100%", height: 42, borderRadius: 12, border: `1px solid ${C.line2}`, background: C.bg2, color: C.text, fontFamily: FONT_DISPLAY, fontSize: 14, paddingLeft: 40, paddingRight: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>

            {/* Lista scrollable */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
              {/* Encabezado */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: C.dimmer, textTransform: "uppercase" }}>
                  {searchQuery.length >= 2 ? "Resultados" : "Asistentes"}
                </div>
                {attendees.length > 0 && <div style={{ fontSize: 11, color: C.dimmer }}>{attendees.length} registros</div>}
              </div>
              {AttendeeList(true, true)}
            </div>
          </div>
        </div>

        <style>{CSS_ANIMATIONS}</style>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LAYOUT MOBILE — rediseño fullscreen
  // ─────────────────────────────────────────────────────────────────────────
  // Semi-transparente: la cámara sigue corriendo detrás — portero puede ya apuntar al siguiente QR
  const resultBg = result
    ? result.kind === "valid" ? "rgba(4,28,14,0.88)" : result.kind === "already_used" ? "rgba(30,22,2,0.88)" : "rgba(32,5,5,0.88)"
    : "transparent";

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, fontFamily: FONT_DISPLAY, color: C.text, userSelect: "none", WebkitUserSelect: "none", overflow: "hidden" }}>

      {/* ── Cámara edge-to-edge ── */}
      <div style={{ position: "absolute", inset: 0 }}>
        <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", opacity: active ? 1 : 0, transition: "opacity 0.4s" }}/>

        {/* Fondo oscuro cuando la cámara no está activa */}
        {!active && (
          <div style={{ position: "absolute", inset: 0, background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            {cameraError ? (
              <>
                <div style={{ fontSize: 14, color: C.dim, textAlign: "center", padding: "0 32px", lineHeight: 1.5 }}>Sin acceso a cámara</div>
                <button type="button" onClick={startCamera} style={{ padding: "10px 22px", borderRadius: 12, border: `1px solid ${C.line2}`, background: C.bg3, color: C.text, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Reintentar</button>
              </>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                {[0,1,2].map((i) => <div key={i} style={{ width: 7, height: 7, borderRadius: 999, background: C.purple, animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}/>)}
              </div>
            )}
          </div>
        )}

        {/* Viñeta oscura en bordes para legibilidad del header */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.65) 100%)", pointerEvents: "none" }}/>

        {/* Marco CUADRADO centrado — el QR es cuadrado, así que el viewfinder también.
            Lado = el menor entre 72% del ancho y 58% del alto (cabe en vertical y horizontal). */}
        {active && (
          <div style={{
            position: "absolute", top: "44%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(72vw, 58vh)", aspectRatio: "1 / 1",
            pointerEvents: "none",
          }}>
            {/* Scan line — dentro del marco */}
            {!result && (
              <div style={{ position: "absolute", left: "6%", right: "6%", height: 2, borderRadius: 999, background: `linear-gradient(90deg, transparent, ${C.green}, transparent)`, boxShadow: `0 0 16px 5px ${C.green}55`, animation: "scanline 2.4s ease-in-out infinite" }}/>
            )}
            {/* Esquinas del marco cuadrado */}
            {(["tl","tr","bl","br"] as const).map((pos) => {
              const isR = pos.includes("r"), isB = pos.includes("b");
              return (
                <div key={pos} style={{
                  position: "absolute",
                  top: isB ? undefined : -1, bottom: isB ? -1 : undefined,
                  left: isR ? undefined : -1, right: isR ? -1 : undefined,
                  width: 34, height: 34,
                  borderTop:    !isB ? `3px solid rgba(255,255,255,0.9)` : "none",
                  borderBottom: isB  ? `3px solid rgba(255,255,255,0.9)` : "none",
                  borderLeft:   !isR ? `3px solid rgba(255,255,255,0.9)` : "none",
                  borderRight:  isR  ? `3px solid rgba(255,255,255,0.9)` : "none",
                  borderRadius: pos === "tl" ? "8px 0 0 0" : pos === "tr" ? "0 8px 0 0" : pos === "bl" ? "0 0 0 8px" : "0 0 8px 0",
                }}/>
              );
            })}
          </div>
        )}

        {/* Hint central cuando está escaneando */}
        {active && !result && (
          <div style={{ position: "absolute", bottom: "22%", left: 0, right: 0, textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500, letterSpacing: "0.03em" }}>
            Apunta al código QR
          </div>
        )}
      </div>

      {/* ── Header flotante (sobre la cámara) ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        paddingTop: "env(safe-area-inset-top, 16px)",
        padding: "calc(env(safe-area-inset-top, 0px) + 14px) 18px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        zIndex: 10,
      }}>
        {/* Logo + evento */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 11, background: C.purple, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 1px rgba(255,255,255,0.15) inset, 0 4px 20px ${C.purpleEdge}`, overflow: "hidden" }}>
            <Logo style={{ width: 22, height: 22 }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", lineHeight: 1 }}>pasape</div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.6)" }}>
              {ev?.title ?? "Modo portero"}
            </div>
          </div>
        </div>

        {/* Estado derecha: stats + online */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {capacity > 0 && (
            <div style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", fontSize: 12, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: C.green }}>{validated}</span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>/{capacity}</span>
            </div>
          )}
          {pendingCount > 0 && (
            <div style={{ padding: "5px 9px", borderRadius: 999, background: C.yellowSoft, fontSize: 11, fontWeight: 700, color: C.yellow }}>{pendingCount} pend.</div>
          )}
          <div style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", fontSize: 11, fontWeight: 700, color: online ? C.green : "rgba(255,255,255,0.4)", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: online ? C.green : "rgba(255,255,255,0.3)", boxShadow: online ? `0 0 6px ${C.green}` : "none", display: "inline-block" }}/>
            {online ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* ── Botón iniciar (cuando cámara no activa) ── */}
      {!active && !cameraError && (
        <div style={{ position: "absolute", bottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)", left: 24, right: 24, zIndex: 10 }}>
          <button type="button" onClick={startCamera} style={{ width: "100%", height: 56, borderRadius: 18, border: 0, background: C.purple, color: "#fff", fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", boxShadow: `0 0 0 1px rgba(255,255,255,0.1) inset, 0 12px 32px -8px ${C.purpleEdge}` }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="12" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="1" y="12" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><circle cx="15" cy="15" r="2" stroke="currentColor" strokeWidth="1.4"/></svg>
            Iniciar escaneo
          </button>
        </div>
      )}

      {/* ── FAB búsqueda (esquina inferior derecha) ── */}
      {!result && (
        <button type="button" onClick={openMobileSearch} style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
          right: 22,
          zIndex: 10,
          width: 56, height: 56,
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(10,10,18,0.75)",
          backdropFilter: "blur(12px)",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      )}

      {/* ── Botón de BENCHMARK: "Ya se ve el QR" → mide visible→reconocido ── */}
      {active && !result && (
        <button
          type="button"
          onClick={markQrVisible}
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 36px)",
            left: "50%", transform: "translateX(-50%)",
            zIndex: 10,
            padding: "12px 22px",
            borderRadius: 999,
            background: measuring ? "rgba(245,197,24,0.92)" : "rgba(255,255,255,0.95)",
            border: "none",
            color: "#0a0a12",
            fontSize: 15, fontWeight: 800, letterSpacing: "-0.01em",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: 999, background: measuring ? "#0a0a12" : C.green, display: "inline-block", animation: "pulse 1.2s ease-in-out infinite" }}/>
          {measuring ? "Midiendo… (apunta firme)" : "Ya se ve el QR → medir"}
        </button>
      )}

      {/* DEBUG: capturar frame de cámara y subirlo al sink */}
      {active && !result && (
        <button
          type="button"
          onClick={captureFrame}
          style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 36px)",
            left: 22, zIndex: 10,
            width: 52, height: 52, borderRadius: 999,
            background: "rgba(10,10,18,0.8)", border: "1px solid rgba(255,255,255,0.18)",
            color: "#fff", fontSize: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          📷{captured > 0 ? <span style={{ position: "absolute", top: -4, right: -4, background: C.green, color: "#0a0a12", fontSize: 11, fontWeight: 800, borderRadius: 999, width: 18, height: 18, display: "grid", placeItems: "center" }}>{captured}</span> : null}
        </button>
      )}

      {/* ── OVERLAY de resultado — semi-transparente, auto-dismiss sin taps ── */}
      {result && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 20,
            background: resultBg,
            backdropFilter: "blur(2px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            padding: "40px 28px",
            animation: "fadeIn 150ms ease-out",
          }}
        >
          {/* BENCHMARK: tiempo de reconocimiento del QR (arriba, bien visible).
              <1s verde, 1-2s ámbar, 2-3s naranja, >3s rojo. */}
          {bench && (
            <div style={{
              position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 16px)",
              left: "50%", transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "8px 16px", borderRadius: 14,
              background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.12)",
            }}>
              <span style={{
                fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em",
                color: bench.ms < 1000 ? C.green : bench.ms < 2000 ? "#f5c518" : bench.ms < 3000 ? "#ff9f1c" : C.red,
              }}>
                ⚡ {bench.ms} ms
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                {bench.attempts} intentos · decode {bench.decodeMs}ms
              </span>
            </div>
          )}

          {/* Icono */}
          <div style={{
            width: 88, height: 88, borderRadius: "50%",
            background: tone,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 50px ${tone}55, 0 0 100px ${tone}22`,
            animation: "popIn 250ms cubic-bezier(0.34,1.5,0.64,1)",
            marginBottom: 24,
          }}>
            {result.kind === "valid" ? (
              <svg width="46" height="46" viewBox="0 0 46 46" fill="none"><path d="M9 23l11 12L37 13" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : result.kind === "already_used" ? (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="#fff" strokeWidth="3.5"/><path d="M20 13v8l4.5 4.5" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M11 11l18 18M29 11L11 29" stroke="#fff" strokeWidth="5" strokeLinecap="round"/></svg>
            )}
          </div>

          {/* Nombre — lo más grande, es lo que el portero necesita leer */}
          <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05, textAlign: "center", color: "#fff", textShadow: `0 0 40px ${tone}44`, marginBottom: 10 }}>
            {result.kind === "valid"
              ? (result.holderName ?? "Entrada válida")
              : result.kind === "already_used"
              ? "Ya ingresó"
              : "QR inválido"}
          </div>

          {/* Tipo de entrada — prominente: Box (para ubicar a la persona) o el nombre
              de la entrada ("Entrada general", "VIP"…), para que el portero lo vea de un vistazo. */}
          {result.kind === "valid" && (result.boxLabel || result.typeName) && (
            <div style={{ marginBottom: 8, padding: "6px 20px", borderRadius: 999, background: "rgba(255,255,255,0.15)", fontSize: 20, fontWeight: 800, letterSpacing: "0.02em", color: "#fff" }}>
              {result.boxLabel ? `Box ${result.boxLabel}` : result.typeName}
            </div>
          )}

          {/* Info secundaria — el pill de arriba ya muestra el tipo/box. Aquí va el
              aforo del box (cuántos del box ya entraron) y el DNI. */}
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.5 }}>
            {result.kind === "valid"
              ? [
                  result.boxLabel && result.boxCapacity ? `${result.boxFilled ?? 0}/${result.boxCapacity} en el box` : null,
                  result.dniLast4 ? `DNI ··${result.dniLast4}` : null,
                ].filter(Boolean).join("  ·  ")
              : result.kind === "already_used"
              ? [result.holderName, result.scannedAt ? `Entró ${fmtTime(result.scannedAt)}` : null].filter(Boolean).join("  ·  ")
              : (result.typeName ?? "QR no pertenece a este evento")}
          </div>

          {/* Acciones — el resultado se queda hasta que el portero toque "Siguiente". */}
          <div style={{
            position: "absolute",
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
            left: 24, right: 24,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <button
              type="button"
              onClick={dismissResult}
              style={{
                flex: 1, height: 60, borderRadius: 18, border: 0,
                background: "#fff", color: "#0a0a12",
                fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 800, letterSpacing: "-0.01em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                cursor: "pointer", boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
              }}
            >
              Siguiente
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h11M11 5l5 5-5 5" stroke="#0a0a12" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {/* Buscar — toque opcional */}
            <button
              type="button"
              onClick={openMobileSearch}
              style={{
                width: 60, height: 60, borderRadius: 18, flexShrink: 0,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.3)",
                color: "rgba(255,255,255,0.7)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom sheet de búsqueda ── */}
      {searchOpen && (
        <>
          <div onClick={closeMobileSearch} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 30, backdropFilter: "blur(4px)" }}/>
          <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: C.bg2, borderRadius: "24px 24px 0 0", border: `1px solid ${C.line}`, paddingBottom: "env(safe-area-inset-bottom, 0px)", maxHeight: "82dvh", display: "flex", flexDirection: "column", animation: "slideUp 240ms cubic-bezier(0.34,1.1,0.64,1)" }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 8px" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: C.line2 }}/>
            </div>
            {/* Título */}
            <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>Buscar asistente</div>
              <button type="button" onClick={closeMobileSearch} style={{ width: 32, height: 32, borderRadius: 999, background: C.bg3, border: "none", color: C.dim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
              </button>
            </div>
            {/* Input */}
            <div style={{ padding: "0 20px 14px", position: "relative" }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ position: "absolute", left: 34, top: "50%", transform: "translateY(-50%)", color: C.dim, pointerEvents: "none" }}>
                <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input ref={mobileInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar por nombre o DNI" autoComplete="off" style={{ width: "100%", height: 50, borderRadius: 15, border: `1px solid ${C.line2}`, background: C.bg3, color: C.text, fontFamily: FONT_DISPLAY, fontSize: 15, paddingLeft: 44, paddingRight: 16, outline: "none", boxSizing: "border-box" }}/>
            </div>
            {/* Lista */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              {AttendeeList(false, false)}
            </div>
          </div>
        </>
      )}

      <style>{CSS_ANIMATIONS}</style>
    </div>
  );
}


const CSS_ANIMATIONS = `
  @keyframes scanline { 0% { top: 22%; } 50% { top: 72%; } 100% { top: 22%; } }
  @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes popIn { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  @keyframes shrink18 { from { width: 100%; } to { width: 0%; } }
  @keyframes shrink25 { from { width: 100%; } to { width: 0%; } }
`;

