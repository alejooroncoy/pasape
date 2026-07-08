import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg px-0 py-12 pb-15">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
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
      </div>
    </footer>
  );
}
