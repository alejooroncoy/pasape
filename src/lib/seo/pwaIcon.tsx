import { ImageResponse } from "next/og";

// Icono de la PWA (install / apple-touch / splash) generado con next/og para
// hornear el fondo: un PNG transparente del perrito, sobre iOS/Android, cae en
// negro y el logo oscuro se pierde. Acá va la estética de las tarjetas claras
// de la app (cart-*): un tile blanco sobre fondo claro tintado, con una sombra
// suave de marca (morado + azul), SIN gradiente ni saturar. El perrito oscuro
// resalta y la sombra le da el toque "nuestro" con sentido, no un blob de IA.

const CANVAS = "#f3f1fb"; // --color-cart-bg-elev (light): fondo tintado sutil
const TILE = "#ffffff"; // tarjeta elevada, como las cart-cards
const PURPLE = "rgba(124,58,237,0.26)"; // sombra de marca (--color-accent)
const BLUE = "rgba(79,109,245,0.18)"; // segundo tono (--color-cart-accent-blue)

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
  // Safe-zone: la maskable la recorta el SO a círculo/squircle, así que el tile
  // se achica para quedar dentro del área segura. La "any" ocupa casi todo.
  const tile = size * (maskable ? 0.62 : 0.78);
  const dogSize = tile * 0.82;
  const radius = size * 0.2;
  const shadow =
    `0 ${size * 0.055}px ${size * 0.13}px ${PURPLE}, ` +
    `0 ${size * 0.018}px ${size * 0.05}px ${BLUE}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: CANVAS,
        }}
      >
        <div
          style={{
            width: tile,
            height: tile,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: TILE,
            borderRadius: radius,
            boxShadow: shadow,
          }}
        >
          {dog ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dog} width={dogSize} height={dogSize} alt="" />
          ) : null}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
