import { Link } from "@/i18n/navigation";
import { Logo } from "./logo";
import { LibroReclamacionesFooterLink } from "@/components/legal/LibroReclamacionesFooterLink";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg px-0 py-12 pb-15">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="flex flex-col items-start gap-4">
            <Logo />
            <p className="m-0 max-w-[60ch] text-sm leading-relaxed text-ink-3">
              Pasape — Sistema operativo para eventos: venta de entradas, pagos,
              QR, boxes, cortesías, promotores, reportes y control de acceso desde
              un solo lugar.
            </p>
            <p className="m-0 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-4">
              © {new Date().getFullYear()} PASAPE · LIMA, PERÚ
            </p>
          </div>
          <FootCol
            title="Explorar"
            links={[
              ["Todos los eventos", "/"],
              ["Conciertos", "/eventos/conciertos"],
              ["Eventos en Lima", "/eventos/lima"],
            ]}
          />
          <FootCol
            title="Ayuda"
            links={[
              ["Centro de ayuda", "/ayuda"],
              ["Preguntas frecuentes", "/ayuda#faq-heading"],
              ["Términos y condiciones", "/terminos"],
              ["Política de privacidad", "/privacidad"],
            ]}
          />
          <div>
            <h5 className="m-0 mb-3.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-2">
              Libro de reclamaciones
            </h5>
            <LibroReclamacionesFooterLink variant="light" />
          </div>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h5 className="m-0 mb-3.5 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-2">
        {title}
      </h5>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-ink-3">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="transition-colors hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
