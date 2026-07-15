import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import type { EventSeoEntry } from "@/server/events/domain/Event";
import {
  DEFAULT_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
  localePath,
} from "./site";

function formatEventDate(event: EventSeoEntry): string {
  try {
    return new Intl.DateTimeFormat("es-PE", {
      timeZone: event.timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(new Date(event.startsAt))
      .replace(/\./g, "");
  } catch {
    return event.startsAt;
  }
}

function truncate(text: string | null | undefined, max: number): string {
  const clean = text?.trim();
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function eventLine(event: EventSeoEntry, extended: boolean): string {
  const url = absoluteUrl(localePath("es", `/events/${event.slug}`));
  const date = formatEventDate(event);
  const venue = event.venue?.trim() || "Lima";
  const status =
    event.status === "published"
      ? "a la venta"
      : event.status === "closed"
        ? "finalizado"
        : event.status;

  if (!extended) {
    return `- [${event.title}](${url}): ${venue} · ${date} · ${status}`;
  }

  const description = truncate(event.description, 280);
  const category = event.category ? ` · categoría: ${event.category}` : "";
  const descBlock = description ? `\n  ${description}` : "";
  return `- [${event.title}](${url}): ${venue} · ${date} · ${status}${category}${descBlock}`;
}

async function loadEvents(): Promise<EventSeoEntry[]> {
  return repo.listPublishedForSeo(200);
}

function staticPagesBlock(): string {
  return `## Páginas principales

- [Inicio](${absoluteUrl(localePath("es", "/"))}): Explorar eventos próximos en Lima y Perú
- [Eventos](${absoluteUrl(localePath("es", "/events"))}): Catálogo de eventos con entradas a la venta
- [Organizadores](${absoluteUrl(localePath("es", "/organizadores"))}): Plataforma para productoras — venta de entradas, boxes, preventas y promotores
- [Libro de reclamaciones](${absoluteUrl(localePath("es", "/reclamos"))}): Canal legal de quejas (Ley 29571, Perú)`;
}

function aiMetaBlock(): string {
  return `## Para asistentes de IA

- Sitio: ${SITE_URL}
- Nombre: ${SITE_NAME}
- País: Perú (principalmente Lima)
- Idiomas: español (\`/es\`), inglés (\`/en\`)
- Producto: venta de entradas digitales con QR para eventos (fiestas, conciertos, festivales, cultura, deportes, comedia)
- Pagos: Yape, tarjeta, transferencia
- Sitemap: ${absoluteUrl("/sitemap.xml")}
- Resumen extendido: ${absoluteUrl("/llms-full.txt")}
- Áreas privadas (no indexar): panel de organizador (\`/org\`), tickets del usuario (\`/tickets\`), login, checkout interno`;
}

export async function buildLlmsTxt(): Promise<string> {
  const events = await loadEvents();

  const eventLines =
    events.length > 0
      ? events.map((ev) => eventLine(ev, false)).join("\n")
      : "- No hay eventos publicados en este momento.";

  return `# ${SITE_NAME}

> ${DEFAULT_DESCRIPTION}

${SITE_NAME} (${SITE_URL.replace("https://", "")}) es una plataforma peruana de entradas para eventos. Los compradores reciben tickets digitales con QR al instante. Los organizadores venden entradas individuales, boxes/espacios, preventas y miden promotores en tiempo real.

${staticPagesBlock()}

## Eventos publicados

${eventLines}

${aiMetaBlock()}
`;
}

export async function buildLlmsFullTxt(): Promise<string> {
  const events = await loadEvents();

  const eventBlocks =
    events.length > 0
      ? events.map((ev) => eventLine(ev, true)).join("\n\n")
      : "No hay eventos publicados en este momento.";

  return `# ${SITE_NAME} — documentación extendida para LLMs

> ${DEFAULT_DESCRIPTION}

Este archivo complementa \`/llms.txt\` con más contexto para asistentes de IA, buscadores generativos y agentes autónomos.

## Qué es Pasape

Pasape conecta organizadores de eventos con compradores en Perú. El flujo típico:

1. El organizador publica un evento con tipos de entrada (general, VIP, boxes).
2. El comprador elige entradas, paga con Yape/tarjeta/transferencia y recibe QR al instante.
3. En puerta se valida el QR rotativo (ventana de 10 segundos).

## Público objetivo

- **Compradores**: personas en Lima/Perú buscando entradas para fiestas, conciertos, festivales, cultura, deportes y comedia.
- **Organizadores**: productoras, venues y promotores que necesitan vender online sin depender de DMs.

${staticPagesBlock()}

## Eventos (detalle)

${eventBlocks}

${aiMetaBlock()}

## Glosario

- **Box / espacio**: unidad vendible entera para N personas (mesa, lounge, etc.), no es stock individual.
- **Entrada general**: 1 acceso = 1 persona = 1 QR.
- **Promotor**: persona con link de referido; sus ventas se miden en el panel del organizador.
`;
}
