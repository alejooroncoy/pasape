import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/Logo";
import { LibroReclamacionesFooterLink } from "@/components/legal/LibroReclamacionesFooterLink";
import { WaIcon } from "./icons";
import { WA_HREF } from "./wa";

// Footer claro, en la misma paleta de la página (el bloque tinta chocaba con
// el resto del home). Superficie apenas elevada + hairline arriba para
// separarlo, marca grande, chip de WhatsApp y cierre centrado tipo Joinnus.
export function Footer() {
  return (
    <footer className="mt-[clamp(48px,6vw,80px)] border-t border-cart-line bg-cart-bg-elev/40 text-[13.5px] text-cart-ink-2">
      <div className="mx-auto max-w-[1320px] px-[clamp(20px,4vw,56px)] py-9">
        <div className="grid grid-cols-[1.3fr_repeat(3,minmax(0,1fr))_auto] gap-8 max-[1100px]:grid-cols-2 max-[560px]:grid-cols-1">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-[21px] font-semibold tracking-[-0.01em] text-cart-ink">
              <span className="grid size-[38px] place-items-center">
                <Logo className="size-full" />
              </span>
              Pasape
            </Link>
            <p className="mt-3.5 max-w-[30ch] text-[13.5px] leading-[1.55] text-cart-ink-2">
              Tu pase a los eventos que valen la pena en Perú.
            </p>
            <a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366]/12 px-4 py-2 text-[12.5px] font-semibold text-[#128C4A] transition-colors hover:bg-[#25D366]/20"
            >
              <WaIcon width={15} height={15} />
              Escríbenos por WhatsApp
            </a>
          </div>
          <FootCol
            title="Explorar"
            links={[
              ["Todos los eventos", "/"],
              ["Conciertos", "/eventos/conciertos"],
              ["Fiestas", "/eventos/fiestas"],
              ["Festivales", "/eventos/festivales"],
              ["Comedia", "/eventos/comedia"],
              ["Eventos en Lima", "/eventos/lima"],
            ]}
          />
          <FootCol
            title="Organizadores"
            links={[
              ["Crear evento", "/organizadores"],
              ["Guías para organizadores", "/blog"],
              ["Precios", "/organizadores#precio"],
              ["Cómo funciona", "/organizadores#como-funciona"],
            ]}
          />
          <FootCol
            title="Ayuda"
            links={[
              ["Centro de ayuda", "/ayuda"],
              ["Preguntas frecuentes", "/ayuda#faq-heading"],
              ["Soy organizador", "/organizadores"],
              ["Términos y condiciones", "/terminos"],
              ["Política de privacidad", "/privacidad"],
            ]}
          />
          <div>
            <LibroReclamacionesFooterLink />
          </div>
        </div>
        {/* Cierre centrado, como Joinnus */}
        <div className="mt-8 border-t border-cart-line-2 pt-4 text-center text-[12.5px] text-cart-ink-2">
          Copyright © Pasape 2026&nbsp;&nbsp;|&nbsp;&nbsp;Todos los derechos reservados&nbsp;&nbsp;·&nbsp;&nbsp;Hecho con ☕ en Perú
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h2 className="m-0 mb-3.5 text-[13px] font-bold tracking-[-0.01em] text-cart-ink">
        {title}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-cart-ink-2 transition-colors hover:text-cart-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
