"use client";

import { Link } from "@/i18n/navigation";
import { PublicAppShell } from "../_home/PublicAppShell";
import { Breadcrumbs } from "@/components/seo/Breadcrumbs";
import type { BreadcrumbItem } from "@/lib/seo/jsonld";
import type { NavUser } from "../_home/Nav";

type Section = { heading: string; body: React.ReactNode };

const LAST_UPDATED = "15 de julio de 2026";

const SECTIONS: Section[] = [
  {
    heading: "1. Aceptación de los términos",
    body: (
      <p>
        Al usar Pasape para comprar entradas, asistir a un evento u organizarlo, aceptas estos
        Términos y Condiciones y nuestra{" "}
        <Link href="/privacidad" className="underline hover:text-cart-ink">
          Política de Privacidad
        </Link>
        . Si no estás de acuerdo, no debes usar la plataforma.
      </p>
    ),
  },
  {
    heading: "2. Qué es Pasape",
    body: (
      <p>
        Pasape es un intermediario tecnológico entre organizadores de eventos y el público:
        procesa la venta de entradas digitales con código QR, gestiona el control de acceso y
        facilita el pago mediante Mercado Pago. Pasape no es el organizador de los eventos que se
        publican en la plataforma, salvo que se indique expresamente.
      </p>
    ),
  },
  {
    heading: "3. Cuentas y compra sin registro",
    body: (
      <p>
        Puedes comprar entradas sin crear una cuenta (guest checkout) usando tu correo
        electrónico, o iniciar sesión con Google para acceder a &quot;Mis entradas&quot; desde
        cualquier dispositivo. Eres responsable de que los datos de contacto que registras sean
        correctos, ya que ahí se te entregará el ticket.
      </p>
    ),
  },
  {
    heading: "4. Precio, comisión de servicio y pagos",
    body: (
      <p>
        El precio de cada entrada lo define el organizador. Pasape cobra una comisión de servicio
        adicional, calculada y mostrada antes de confirmar el pago. El monto final que se muestra
        en el checkout es siempre el que determina el servidor de Pasape; cualquier estimado previo
        es referencial. Los pagos se procesan a través de Mercado Pago bajo sus propios términos.
      </p>
    ),
  },
  {
    heading: "5. Entradas, QR y control de acceso",
    body: (
      <p>
        Cada entrada se entrega como un código QR único y rotativo, válido para un solo ingreso.
        Eres responsable de no compartir tu QR con terceros que no vayan a usarlo: Pasape no se
        responsabiliza por el uso indebido de un ticket compartido o reenviado por decisión del
        titular.
      </p>
    ),
  },
  {
    heading: "6. Transferencia de entradas y reventa",
    body: (
      <p>
        Cuando el organizador lo permite, puedes transferir una entrada a otra persona a través del
        canal oficial de Pasape. No garantizamos ni promovemos la reventa de entradas fuera de la
        plataforma; cualquier transacción realizada por fuera de Pasape es responsabilidad
        exclusiva de las partes involucradas.
      </p>
    ),
  },
  {
    heading: "7. Cancelaciones, reembolsos y cambios de fecha",
    body: (
      <p>
        Las políticas de reembolso y cambio de fecha las define cada organizador y se muestran en
        la página del evento antes de la compra. Si un evento es cancelado por el organizador,
        Pasape coordinará el proceso de reembolso según la información disponible al momento.
      </p>
    ),
  },
  {
    heading: "8. Uso aceptable",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>No usar bots, scripts o automatizaciones para comprar entradas de forma masiva.</li>
        <li>No falsificar, duplicar o alterar códigos QR de entradas.</li>
        <li>No suplantar la identidad de otra persona al comprar o ingresar a un evento.</li>
        <li>No usar la plataforma para fines fraudulentos o ilegales.</li>
      </ul>
    ),
  },
  {
    heading: "9. Organizadores y promotores",
    body: (
      <p>
        Los organizadores son responsables de la veracidad de la información del evento, de
        cumplir los permisos y licencias que exija la ley, y de honrar las condiciones de venta
        publicadas. Los promotores que venden por comisión se rigen por el acuerdo específico
        pactado con cada organizador dentro de la plataforma.
      </p>
    ),
  },
  {
    heading: "10. Límites de responsabilidad",
    body: (
      <p>
        Pasape no se responsabiliza por la realización, calidad, seguridad o cambios del evento en
        sí (eso corresponde al organizador). Nuestra responsabilidad se limita a la correcta
        emisión y validación de la entrada digital adquirida a través de la plataforma.
      </p>
    ),
  },
  {
    heading: "11. Modificaciones",
    body: (
      <p>
        Podemos actualizar estos Términos y Condiciones para reflejar cambios en el servicio o la
        normativa aplicable. La fecha de la última actualización se publica al inicio de esta
        página.
      </p>
    ),
  },
  {
    heading: "12. Contacto y reclamos",
    body: (
      <p>
        Para consultas o reclamos, escríbenos a{" "}
        <a href="mailto:soporte@pasape.lat" className="underline hover:text-cart-ink">
          soporte@pasape.lat
        </a>{" "}
        o usa nuestro{" "}
        <Link href="/reclamos" className="underline hover:text-cart-ink">
          Libro de Reclamaciones
        </Link>
        , conforme al Código de Protección y Defensa del Consumidor (Ley 29571).
      </p>
    ),
  },
];

export function TerminosClient({
  user,
  breadcrumbs,
}: {
  user: NavUser | null;
  breadcrumbs: BreadcrumbItem[];
}) {
  return (
    <PublicAppShell user={user}>
      <Breadcrumbs items={breadcrumbs} />
      <h1 className="mt-4 font-sans text-[clamp(26px,4vw,36px)] font-bold tracking-[-0.03em] text-cart-ink">
        Términos y Condiciones
      </h1>
      <p className="mt-2 text-[13px] text-cart-ink-4">Última actualización: {LAST_UPDATED}</p>

      <div className="mt-8 space-y-8 text-[14.5px] leading-relaxed text-cart-ink-2">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="text-[17px] font-semibold text-cart-ink">{s.heading}</h2>
            <div className="mt-2.5">{s.body}</div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[13px] text-cart-ink-4">
        Revisa también nuestra{" "}
        <Link href="/privacidad" className="underline hover:text-cart-ink">
          Política de Privacidad
        </Link>
        .
      </p>
    </PublicAppShell>
  );
}
