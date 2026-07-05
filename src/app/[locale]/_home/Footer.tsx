import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

export function Footer() {
  return (
    <footer className="mt-[clamp(64px,9vw,120px)] border-t border-cart-line px-[clamp(20px,4vw,56px)] py-12 text-[13.5px] text-cart-ink-3">
      <div className="mx-auto max-w-[1320px]">
        <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] gap-8 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5 text-[19px] font-semibold tracking-[-0.01em] text-white">
              <span className="grid size-[34px] place-items-center">
                <Logo className="size-full" />
              </span>
              Pasape
            </Link>
            <p className="mt-4 max-w-[32ch] text-[13.5px] leading-[1.55] text-cart-ink-3">
              Tu pase a los eventos que valen la pena en Lima.
            </p>
          </div>
          <FootCol title="Explorar" links={[
            ["Conciertos", "/events"],
            ["Fiestas", "/events"],
            ["Festivales", "/events"],
            ["Comedia", "/events"],
          ]} />
          <FootCol title="Organizadores" links={[
            ["Crear evento", "/organizadores"],
            ["Precios", "/organizadores#precio"],
            ["App de puerta", "#"],
            ["Centro de ayuda", "#"],
          ]} />
          <FootCol title="Pasape" links={[
            ["Sobre nosotros", "#"],
            ["Ayuda", "#"],
            ["Contacto", "#"],
            ["Términos", "#"],
            ["Privacidad", "#"],
          ]} />
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-cart-line-2 pt-[22px] text-[12.5px] text-cart-ink-4">
          <span>© 2026 Pasape S.A.C. — Lima, Perú.</span>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="/complaints"
              className="inline-flex items-center gap-2 rounded-md border border-cart-line-2 px-3 py-1.5 text-cart-ink-3 transition-colors hover:border-white/40 hover:text-white"
            >
              <span aria-hidden className="text-[14px]">📖</span>
              Libro de Reclamaciones
            </a>
            <span>Hecho con ☕ en Perú.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FootCol({ title, links }: { title: string; links: Array<[string, string]> }) {
  return (
    <div>
      <h5 className="m-0 mb-3.5 text-[11.5px] font-medium uppercase tracking-[0.1em] text-cart-ink-2">
        {title}
      </h5>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {links.map(([label, href]) => (
          <li key={label}>
            <a href={href} className="transition-colors hover:text-white">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
