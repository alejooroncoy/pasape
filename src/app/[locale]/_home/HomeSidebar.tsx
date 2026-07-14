import { Link } from "@/i18n/navigation";
import { WaIcon } from "./icons";
import { WA_HREF } from "./wa";

// Sidebar del home (patrón Joinnus/Teleticket: la columna derecha baja junto al
// contenido con banners útiles propios, no publicidad). Tiles TIPOGRÁFICOS de
// color sólido — sin la card genérica icono+título+descripción que huele a IA.
export function HomeSidebar() {
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      {/* ── Así funciona Pasape ── */}
      <div className="rounded-[18px] border border-cart-line bg-cart-bg-elev/50 p-4">
        <h2 className="m-0 mb-3 font-sans text-[15px] font-semibold tracking-[-0.01em] text-cart-ink">
          ¿Cómo funciona Pasape?
        </h2>
        <div className="flex flex-col gap-2.5 max-lg:grid max-lg:grid-cols-1 sm:max-lg:grid-cols-3">
          <PromoTile
            bg="linear-gradient(120deg, #6d28d9 0%, #8b5cf6 100%)"
            big="QR al instante"
            small="En tu pantalla y por WhatsApp"
            art={
              <svg width="92" height="92" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 3h7v7H3V3zm2 2v3h3V5H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zM14 14h3v3h-3v-3zM18 18h3v3h-3v-3z"
                  fill="currentColor"
                />
              </svg>
            }
          />
          <PromoTile
            bg="linear-gradient(120deg, #3b5bdb 0%, #4f6df5 100%)"
            big="Yape o tarjeta"
            small="Con respaldo de Mercado Pago"
            art={
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="2" y="5" width="20" height="14" rx="2.5" fill="currentColor" />
                <rect x="2" y="8.5" width="20" height="3" fill="rgba(0,0,0,0.35)" />
                <rect x="5" y="14.5" width="6" height="2" rx="1" fill="rgba(0,0,0,0.3)" />
              </svg>
            }
          />
          <PromoTile
            bg="#16132a"
            big="Sin crear cuenta"
            small="Compras como invitado en un minuto"
            art={
              <svg width="96" height="96" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 7a2 2 0 012-2h14a2 2 0 012 2v2.5a2.5 2.5 0 000 5V17a2 2 0 01-2 2H5a2 2 0 01-2-2v-2.5a2.5 2.5 0 000-5V7z"
                  fill="currentColor"
                />
                <path d="M14.5 5v14" stroke="rgba(0,0,0,0.35)" strokeWidth="1.4" strokeDasharray="2 2.4" />
              </svg>
            }
          />
        </div>
      </div>

      {/* ── Para organizadores — mismo tratamiento de banner gráfico que las
          tiles de arriba: motivo grande recortado (barras de ventas subiendo)
          y badge en pill en vez de eyebrow en mayúsculas. ── */}
      <div className="relative overflow-hidden rounded-[18px] bg-[#16132a] p-5 text-white">
        <span
          className="pointer-events-none absolute -bottom-6 -right-4 text-[#8b5cf6]/[0.22]"
          style={{ transform: "rotate(-8deg)" }}
          aria-hidden
        >
          <svg width="130" height="130" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="13" width="4" height="8" rx="1.2" fill="currentColor" />
            <rect x="10" y="9" width="4" height="12" rx="1.2" fill="currentColor" />
            <rect x="17" y="4" width="4" height="17" rx="1.2" fill="currentColor" />
            <path d="M4 8.5 10 5l4.5 2L20 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="relative mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-[#c4b5fd]">
          <span className="size-1.5 rounded-full bg-[#8b5cf6]" aria-hidden />
          Organizadores
        </span>
        <h2 className="relative m-0 mb-1.5 font-sans text-[19px] font-extrabold leading-tight tracking-[-0.02em]">
          Publica tu evento y véndelo hoy
        </h2>
        <p className="relative m-0 mb-4 max-w-[26ch] text-[12.5px] leading-[1.5] text-white/65">
          Cobra con Yape o tarjeta, reparte los QRs al instante y mira tus ventas en vivo.
        </p>
        <Link
          href="/organizadores"
          className="relative inline-flex items-center gap-2 rounded-full bg-cart-accent px-5 py-2.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-px"
        >
          Vende con Pasape
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {/* ── Ayuda — chip de soporte con la insignia real de WhatsApp (verde),
          como el #SOPORTEFANS de Teleticket: se reconoce al instante. ── */}
      <a
        href={WA_HREF}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-3.5 rounded-[18px] border border-cart-line bg-cart-bg-elev/50 px-4 py-4 transition-colors hover:border-[#25D366]/50"
      >
        <span className="grid size-11 flex-shrink-0 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_6px_16px_-6px_rgba(37,211,102,0.55)]">
          <WaIcon width={22} height={22} />
        </span>
        <div className="min-w-0">
          <p className="m-0 text-[14px] font-bold text-cart-ink">¿Dudas con tu entrada?</p>
          <p className="m-0 mt-0.5 text-[12px] text-cart-ink-3">
            Escríbenos, respondemos rápido
          </p>
        </div>
      </a>
    </aside>
  );
}

// Mini-banner gráfico (estilo sidebar de Joinnus/Teleticket): composición con
// un motivo grande recortado en la esquina — se lee como banner diseñado, no
// como bloque de texto.
function PromoTile({
  bg,
  big,
  small,
  art,
}: {
  bg: string;
  big: string;
  small: string;
  art: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-[14px] px-4 py-4 text-white" style={{ background: bg }}>
      <span
        className="pointer-events-none absolute -bottom-4 -right-3 text-white/[0.16]"
        style={{ transform: "rotate(-10deg)" }}
        aria-hidden
      >
        {art}
      </span>
      <p className="relative m-0 text-[15px] font-bold leading-tight">{big}</p>
      <p className="relative m-0 mt-1 max-w-[21ch] text-[11.5px] leading-snug text-white/75">{small}</p>
    </div>
  );
}
