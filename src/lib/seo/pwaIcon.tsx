import { ImageResponse } from "next/og";

// Icono de la PWA (install / apple-touch / splash) generado con next/og para
// hornear el fondo: un PNG transparente del perrito, sobre iOS/Android, cae en
// negro y el logo oscuro se pierde. Mismo tratamiento que logo-badge-light.svg
// (badge de login con Google, aprobado jul 2026): fondo blancquito + hairline
// + "chispazos" morado/azul dispersos + perrito de trazo oscuro. Sin gradiente,
// sin tile-con-sombra — un solo lenguaje visual entre badge y PWA.

const CANVAS = "#fbfaff"; // --color-cart-bg (light)
const HAIRLINE = "rgba(28,20,60,.14)";
const PURPLE = "#7C3AED";
const BLUE = "#4F6DF5";

// Posiciones tomadas de logo-badge-light.svg (viewBox 512) — mismos chispazos,
// escalados al tamaño pedido para que badge y PWA se vean como un solo sistema.
const SPLASHES: { x: number; y: number; r: number; color: string; opacity?: number }[] = [
  { x: 88, y: 96, r: 14, color: PURPLE },
  { x: 120, y: 70, r: 6, color: BLUE },
  { x: 430, y: 120, r: 9, color: BLUE },
  { x: 404, y: 86, r: 5, color: PURPLE },
  { x: 446, y: 380, r: 11, color: PURPLE },
  { x: 418, y: 416, r: 6, color: BLUE },
  { x: 70, y: 410, r: 7, color: BLUE },
  { x: 96, y: 440, r: 4, color: PURPLE },
];

const SPARKLES: { x: number; y: number; s: number; color: string; opacity?: number }[] = [
  { x: 379, y: 183, s: 26, color: BLUE },
  { x: 65, y: 257, s: 16, color: PURPLE, opacity: 0.7 },
];

async function loadDog(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    // El perrito de contorno oscuro (transparente) — pensado para fondo claro.
    const buf = await readFile(join(process.cwd(), "public/icons/logo-dark-square-512.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function createPwaIcon(size: number, opts?: { maskable?: boolean }) {
  const dog = await loadDog();
  const maskable = opts?.maskable ?? false;
  const scale = size / 512;
  // Safe-zone: la maskable la recorta el SO a círculo/squircle, así que el
  // perrito y los chispazos se achican para quedar dentro del área segura.
  const dogSize = size * (maskable ? 0.64 : 0.82);
  const radius = size * 0.22;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          background: CANVAS,
          borderRadius: maskable ? 0 : radius,
          border: maskable ? "none" : `${Math.max(1, size * 0.004)}px solid ${HAIRLINE}`,
        }}
      >
        {SPLASHES.map((s, i) => (
          <div
            key={`splash-${i}`}
            style={{
              position: "absolute",
              left: s.x * scale - s.r * scale,
              top: s.y * scale - s.r * scale,
              width: s.r * 2 * scale,
              height: s.r * 2 * scale,
              borderRadius: "50%",
              background: s.color,
              opacity: s.opacity ?? 1,
              display: "flex",
            }}
          />
        ))}
        {SPARKLES.map((s, i) => (
          <div
            key={`sparkle-${i}`}
            style={{
              position: "absolute",
              left: s.x * scale - (s.s * scale) / 2,
              top: s.y * scale - (s.s * scale) / 2,
              width: s.s * scale,
              height: s.s * scale,
              background: s.color,
              opacity: s.opacity ?? 1,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          />
        ))}
        {dog ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dog} width={dogSize} height={dogSize} alt="" style={{ position: "relative" }} />
        ) : null}
      </div>
    ),
    { width: size, height: size },
  );
}
