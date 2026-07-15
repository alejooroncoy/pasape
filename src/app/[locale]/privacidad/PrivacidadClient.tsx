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
    heading: "1. Quiénes somos",
    body: (
      <p>
        Pasape (&quot;Pasape&quot;, &quot;nosotros&quot;) es una plataforma de venta de entradas y
        gestión de eventos operada desde Perú. Esta política explica qué datos personales
        recopilamos de compradores, asistentes, organizadores y promotores, para qué los usamos y
        qué derechos tienes sobre ellos, en línea con la Ley N.° 29733 de Protección de Datos
        Personales.
      </p>
    ),
  },
  {
    heading: "2. Datos que recopilamos",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>
          <strong>Identidad y contacto:</strong> nombre, correo electrónico, teléfono. Si inicias
          sesión con Google, recibimos el nombre, correo y foto de perfil asociados a esa cuenta.
        </li>
        <li>
          <strong>Documento de identidad (DNI/CE):</strong> del titular de cada entrada, para
          validar el acceso en puerta. Se almacena cifrado; en el ticket físico/QR solo se muestran
          los últimos 4 dígitos.
        </li>
        <li>
          <strong>Datos de pago:</strong> los procesamos a través de Mercado Pago; Pasape no
          almacena números de tarjeta completos. Mercado Pago puede compartirnos el resultado de la
          transacción y datos de verificación antifraude (ej. device ID).
        </li>
        <li>
          <strong>Comunicaciones:</strong> si te contactamos por WhatsApp (vía Kapso) para
          confirmaciones o soporte, registramos esas conversaciones.
        </li>
        <li>
          <strong>Uso de la plataforma:</strong> eventos vistos, favoritos, compras, y datos
          técnicos (dirección IP, dispositivo, cookies) con fines analíticos y de prevención de
          fraude.
        </li>
      </ul>
    ),
  },
  {
    heading: "3. Para qué usamos tus datos",
    body: (
      <ul className="list-disc space-y-1.5 pl-5">
        <li>Procesar la compra de entradas y emitir tus tickets con código QR.</li>
        <li>Validar tu identidad en el control de acceso del evento.</li>
        <li>Enviarte confirmaciones, recordatorios y soporte por correo o WhatsApp.</li>
        <li>
          Prevenir fraude, reventa no autorizada y abuso de la plataforma (ej. límites de compra
          por comprador).
        </li>
        <li>Cumplir obligaciones legales, tributarias y de atención de reclamos.</li>
        <li>Mejorar la plataforma mediante analítica agregada de uso.</li>
      </ul>
    ),
  },
  {
    heading: "4. Con quién compartimos tus datos",
    body: (
      <p>
        Compartimos datos con proveedores estrictamente necesarios para operar el servicio:{" "}
        <strong>Mercado Pago</strong> (procesamiento de pagos), <strong>Supabase</strong>{" "}
        (autenticación y base de datos), <strong>Google</strong> (si eliges iniciar sesión con tu
        cuenta de Google) y <strong>Kapso</strong> (mensajería de WhatsApp). También compartimos con
        el organizador del evento los datos necesarios para operar su lista de asistentes y control
        de acceso (nombre, y si aplica, DNI del titular). No vendemos tus datos personales a
        terceros.
      </p>
    ),
  },
  {
    heading: "5. Cookies y analítica",
    body: (
      <p>
        Usamos cookies esenciales para mantener tu sesión iniciada y cookies analíticas para
        entender el uso de la plataforma y mejorar la experiencia. Puedes gestionar las cookies
        desde la configuración de tu navegador.
      </p>
    ),
  },
  {
    heading: "6. Tus derechos (ARCO)",
    body: (
      <p>
        Puedes solicitar acceso, rectificación, cancelación u oposición sobre tus datos personales
        (derechos ARCO) escribiendo a{" "}
        <a href="mailto:soporte@pasape.lat" className="underline hover:text-cart-ink">
          soporte@pasape.lat
        </a>
        . Atenderemos tu solicitud dentro de los plazos que establece la ley peruana.
      </p>
    ),
  },
  {
    heading: "7. Conservación y seguridad",
    body: (
      <p>
        Conservamos tus datos mientras mantengas una cuenta activa o mientras sea necesario para
        cumplir obligaciones legales (ej. registros tributarios). Los documentos de identidad se
        almacenan cifrados y el acceso está restringido a los sistemas de validación de entrada.
      </p>
    ),
  },
  {
    heading: "8. Cambios a esta política",
    body: (
      <p>
        Podemos actualizar esta política para reflejar cambios en el servicio o la normativa
        vigente. Publicaremos la fecha de la última actualización al inicio de esta página.
      </p>
    ),
  },
];

export function PrivacidadClient({
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
        Política de Privacidad
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
        ¿Tienes dudas sobre tu privacidad?{" "}
        <Link href="/reclamos" className="underline hover:text-cart-ink">
          Ir al Libro de Reclamaciones
        </Link>{" "}
        o revisa nuestros{" "}
        <Link href="/terminos" className="underline hover:text-cart-ink">
          Términos y Condiciones
        </Link>
        .
      </p>
    </PublicAppShell>
  );
}
