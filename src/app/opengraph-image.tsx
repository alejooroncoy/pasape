import { ImageResponse } from "next/og";

// Imagen Open Graph por defecto para toda la app (1200×630). Las rutas que
// necesiten su propia imagen pueden definir su propio opengraph-image.
export const runtime = "nodejs";
export const alt = "Pasape | Tu pase a los eventos que valen la pena en Lima";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logoSrc = await loadLogo();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0a0a0f",
          position: "relative",
        }}
      >
        {/* Glow morado ambiente — misma atmósfera "stained purple" de la home */}
        <div
          style={{
            position: "absolute",
            top: -260,
            left: 120,
            width: 900,
            height: 900,
            background:
              "radial-gradient(closest-side, rgba(184,124,255,0.40), rgba(168,85,247,0.12) 45%, transparent 72%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -320,
            right: -120,
            width: 760,
            height: 760,
            background:
              "radial-gradient(closest-side, rgba(168,85,247,0.22), transparent 70%)",
            display: "flex",
          }}
        />

        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoSrc ? <img src={logoSrc} width={132} height={132} alt="" /> : null}
          <span
            style={{
              fontSize: 104,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.03em",
            }}
          >
            Pasape
          </span>
        </div>

        {/* Tagline + dominio */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span
            style={{
              fontSize: 52,
              fontWeight: 600,
              color: "#d6d6e0",
              letterSpacing: "-0.02em",
              maxWidth: 920,
              lineHeight: 1.15,
            }}
          >
            Tu pase a los eventos que valen la pena en Lima.
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 600,
                color: "#0a0a0f",
                background: "#b87cff",
                padding: "10px 22px",
                borderRadius: 999,
              }}
            >
              pasa.pe
            </span>
            <span style={{ fontSize: 28, color: "#8e8ea1" }}>
              Entradas digitales con QR · combos · promotores
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

// Carga el logo como data URI. Estrategia robusta: lee del filesystem (runtime
// nodejs) y, si falla, devuelve null para no romper la generación de la imagen.
async function loadLogo(): Promise<string | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(
      join(process.cwd(), "public/icons/logo-icon-min-512.png"),
    );
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
