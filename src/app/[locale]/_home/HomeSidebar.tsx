import { Link } from "@/i18n/navigation";
import { WaIcon } from "./icons";
import { WA_HREF } from "./wa";

// Columna derecha del home (patrón Joinnus/Teleticket: baja junto al contenido
// con bloques útiles propios, no publicidad). En móvil se apila debajo.
//
// Antes eran tres tiles iguales de degradado morado/azul con un glifo grande
// recortado. Dos problemas: el degradado como RELLENO contradice la regla de la
// casa (el color es acento, nunca fondo), y el trío de tarjetas idénticas
// icono+título+texto es la estructura de página más genérica que existe. Ahora
// los mismos tres hechos se cuentan como lo que realmente son: los pasos de una
// compra, en orden, con hairlines y tipografía apretada.
export function HomeSidebar() {
  return (
    <aside className="flex min-w-0 flex-col gap-4">
      <section className="rounded-[18px] border border-cart-line bg-cart-bg-elev/50 p-4">
        <h2 className="m-0 font-sans text-[15px] font-semibold tracking-[-0.01em] text-cart-ink">
          Comprar toma un minuto
        </h2>
        <ol className="m-0 mt-1 list-none p-0">
          <Step n={1} title="Eliges tu evento y tus entradas">
            Sin crear cuenta. Solo tu correo para recibirlas.
          </Step>
          <Step n={2} title="Pagas con Yape o tarjeta">
            Con el respaldo de Mercado Pago.
          </Step>
          <Step n={3} title="Te llega el QR al instante">
            En tu pantalla y por WhatsApp, apenas se confirma el pago.
          </Step>
        </ol>
      </section>

      {/* Única superficie oscura de la columna, y a propósito: le habla a otro
          público. El contraste hace el trabajo que antes hacía un badge. */}
      <section className="rounded-[18px] bg-[#16132a] p-5 text-white">
        <h2 className="m-0 font-sans text-[19px] font-bold leading-[1.15] tracking-[-0.02em]">
          Publica tu evento y véndelo hoy
        </h2>
        <p className="m-0 mt-2 max-w-[28ch] text-[12.5px] leading-[1.55] text-white/80">
          Cobra con Yape o tarjeta, reparte los QRs al instante y mira tus ventas en vivo.
        </p>
        <Link
          href="/organizadores"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-cart-accent px-5 text-[13px] font-bold text-white transition-transform hover:-translate-y-px"
        >
          Vende con Pasape
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>

      {/* Ayuda — la insignia real de WhatsApp (verde de marca ajena, no del
          sistema): se reconoce al instante, como el #SOPORTEFANS de Teleticket. */}
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
          <p className="m-0 mt-0.5 text-[12px] text-cart-ink-3">Escríbenos, respondemos rápido</p>
        </div>
      </a>
    </aside>
  );
}

// Paso de la compra. El número va en mono porque es un dato de secuencia, no un
// adorno "técnico"; el hairline superior separa sin dibujar una caja nueva.
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[18px_minmax(0,1fr)] gap-x-3 border-t border-cart-line-2 py-3 first:border-t-0">
      <span className="pt-px font-mono text-[12.5px] font-semibold tabular-nums text-cart-accent-strong">
        {n}
      </span>
      <div className="min-w-0">
        <p className="m-0 text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-cart-ink">
          {title}
        </p>
        <p className="m-0 mt-0.5 text-[12.5px] leading-[1.5] text-cart-ink-3">{children}</p>
      </div>
    </li>
  );
}
