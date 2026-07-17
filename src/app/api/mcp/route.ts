import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { verifyApiKey } from "@/server/identity/apiKeys/application/VerifyApiKey";
import { verifyAccessToken } from "@/server/identity/oauth/application/VerifyAccessToken";
import { createEvent } from "@/server/events/application/CreateEvent";
import { updateEvent } from "@/server/events/application/UpdateEvent";
import { listEventsByOrganization } from "@/server/events/application/ListEventsByOrganization";
import { getEventStats } from "@/server/events/application/GetEventStats";
import {
  createTicketType,
  updateTicketType,
  deleteTicketType,
} from "@/server/events/application/ManageTicketTypes";
import { exportEventReport } from "@/server/events/application/ExportEventReport";
import { generateDoorLink } from "@/server/events/application/GenerateDoorLink";
import {
  listEventCoOrganizers,
  removeEventCoOrganizer,
  inviteEventCoOrganizer,
} from "@/server/events/application/EventCoOrganizers";
import { supabaseInviteRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseInviteRepository";
import { supabaseMembershipRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseMembershipRepository";
import { supabaseUserRepository } from "@/server/identity/infrastructure/repositories/SupabaseUserRepository";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { supabaseLegalEntityRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseLegalEntityRepository";
import { createInvite } from "@/server/identity/organizations/application/CreateInvite";
import { listEventAccesos } from "@/server/events/application/ListEventAccesos";
import { listZones, createZone, updateZone, deleteZone } from "@/server/events/application/ManageZones";
import {
  updateAssignmentCommission,
  removeAssignment,
} from "@/server/promoters/application/EventPromoterAssignment";
import { listPendingApplications, decideApplication } from "@/server/promoters/application/PromoterServices";
import { getOrgPromoterDetail } from "@/server/promoters/application/PromoterDetail";
import { coerceCommissionConfig } from "@/server/promoters/application/CommissionResolver";
import { supabasePromoterRepository } from "@/server/promoters/infrastructure/repositories/SupabasePromoterRepository";
import type { CommissionConfig } from "@/server/promoters/domain/OrgPromoter";
import type { EventPromoterScheme } from "@/server/events/ports/EventRepository";
import {
  dispatchTeamInviteNotification,
  buildInviteUrl,
} from "@/server/identity/organizations/application/dispatchTeamInviteNotification";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { supabaseTicketRepository as ticketRepo } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
import {
  listPendingApprovals as listPendingApprovalsUc,
  approveRegistration as approveRegistrationUc,
  rejectRegistration as rejectRegistrationUc,
} from "@/server/tickets/application/RegistrationApprovals";
import {
  issueCourtesy as issueCourtesyUc,
  listCourtesies as listCourtesiesUc,
} from "@/server/tickets/application/Courtesies";
import { supabaseOrgPromoterRepository as orgPromoterRepo } from "@/server/promoters/infrastructure/repositories/SupabaseOrgPromoterRepository";
import {
  assignOrgPromotersToEvent,
  listAssignmentsForEvent,
} from "@/server/promoters/application/EventPromoterAssignment";
import { customFieldObjectSchema, withSelectOptionsRule } from "@/lib/events/customFields";
import type { ApiKeyIdentity } from "@/server/identity/apiKeys/domain/ApiKey";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { EVENT_ASSETS_BUCKET } from "@/lib/events/uploadEventAsset";

const EVENT_CATEGORIES = [
  "conciertos",
  "fiestas",
  "festivales",
  "comedia",
  "cultura",
  "deportes",
  "charlas",
] as const;

// process.env directo (no next/headers): el callback de un tool MCP no
// siempre corre dentro del request scope que headers() espera.
const appOrigin = (): string =>
  (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://pasape.lat").replace(/\/+$/, "");

// Sin esto, el agente (Claude, etc.) no tiene de dónde sacar el link real del
// evento y termina inventando una URL (visto en vivo: alucinó "/e/<slug>",
// que no existe) — /es/ explícito porque next-intl usa localePrefix "always".
const eventUrl = (slug: string): string => `${appOrigin()}/es/events/${slug}`;

// "Pasape MCP": deja que Claude/Cursor/otros agentes creen y gestionen
// eventos hablando en lenguaje natural. Auth primaria: OAuth 2.1 (conectar
// desde Claude.ai/Claude Desktop pegando esta URL — sin copiar secretos, ver
// /oauth/authorize). El API key manual (pk_live_...) queda como fallback
// interno para scripts/debug, no es la vía que ve un organizador casual.
// Cada tool reusa la MISMA capa de aplicación que ya usa la UI (createEvent,
// updateEvent, ...) — el MCP no reimplementa ninguna regla de negocio, solo
// la traduce a lenguaje de tools.

// `id` opcional acá: el organizador (o el agente en su nombre) no tiene por
// qué inventar un uuid al crear una pregunta nueva — se genera server-side.
const eventCustomFieldInput = withSelectOptionsRule(
  customFieldObjectSchema.omit({ id: true }).extend({ id: z.string().uuid().optional() }),
);

// `capacity` null/ausente = sin límite (eventos virtuales o sin aforo físico)
// — solo para kind="general". Un box SIEMPRE es finito (asientos reales), así
// que ahí `capacity` sigue siendo obligatorio.
const ticketTypeInput = z
  .object({
    name: z.string().min(1),
    kind: z.enum(["general", "box"]).default("general"),
    priceCents: z.number().int().min(0).default(0),
    capacity: z
      .number()
      .int()
      .min(0)
      .nullable()
      .optional()
      .describe("Cupo. Null o ausente = sin límite (solo válido si kind=general)."),
    boxLabel: z.string().trim().min(1).max(40).optional(),
    requiresApproval: z
      .boolean()
      .optional()
      .describe(
        "RSVP con aprobación (estilo Luma): el organizador aprueba/rechaza cada inscripción " +
          "antes de emitir el QR. Solo válido si priceCents=0.",
      ),
  })
  .refine((v) => v.kind !== "box" || v.capacity != null, {
    message: "Un box necesita capacity (asientos) — no puede ser sin límite",
    path: ["capacity"],
  })
  .refine((v) => !v.requiresApproval || v.priceCents === 0, {
    message: "requiresApproval solo es válido para entradas gratis (priceCents=0)",
    path: ["requiresApproval"],
  });

const identityFromAuth = (authInfo: AuthInfo | undefined): ApiKeyIdentity => {
  const extra = authInfo?.extra as ApiKeyIdentity | undefined;
  if (!extra?.organizationId || !extra?.createdBy) {
    throw new Error("missing_organizer_identity");
  }
  return extra;
};

// El puerto no expone getById (solo getBySlug, para el detalle público) — el
// MCP habla en eventId porque es lo que create_event devuelve. La lista de
// eventos de una org es chica (nunca miles), así que reusar
// listEventsByOrganization es más barato que agregar un método de puerto
// nuevo solo para este caso.
const findEventById = async (organizationId: string, eventId: string) => {
  const events = await listEventsByOrganization({ repo }, organizationId);
  return events.find((e) => e.id === eventId) ?? null;
};

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "create_event",
      {
        title: "Crear evento",
        description:
          "Crea un evento nuevo en Pasape (queda en borrador). Para venderlo primero hay que " +
          "publicarlo con publish_event. Los precios van en centavos de sol (S/10.00 = 1000).",
        inputSchema: {
          title: z.string().min(1).describe("Nombre del evento"),
          description: z.string().nullable().optional(),
          venue: z.string().nullable().optional().describe("Nombre del lugar, texto libre"),
          startsAt: z.string().describe("Fecha/hora de inicio, ISO 8601"),
          endsAt: z.string().nullable().optional(),
          timezone: z.string().default("America/Lima"),
          category: z
            .enum(EVENT_CATEGORIES)
            .nullable()
            .optional()
            .describe("Tipo de evento — conciertos/fiestas/festivales/comedia/cultura/deportes/charlas."),
          ticketTypes: z
            .array(ticketTypeInput)
            .min(1)
            .describe("Al menos un tipo de entrada. Para RSVP gratis: priceCents=0."),
          customFields: z
            .array(eventCustomFieldInput)
            .optional()
            .describe("Preguntas extra de registro, estilo Luma (ver set_custom_fields)."),
        },
        annotations: { destructiveHint: false },
      },
      async (input, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await createEvent(
          { repo },
          {
            organizationId: identity.organizationId,
            createdBy: identity.createdBy,
            title: input.title,
            description: input.description ?? null,
            venue: input.venue ?? null,
            venueLat: null,
            venueLng: null,
            venueUrl: null,
            venueSource: null,
            venueLayoutUrl: null,
            startsAt: input.startsAt,
            endsAt: input.endsAt ?? null,
            timezone: input.timezone,
            category: input.category ?? null,
            totalCapacity: null,
            overbookPct: 0,
            transfersEnabled: true,
            transferDeadlineHours: null,
            transferMaxCount: 1,
            transferRequiresKyc: false,
            customFields: (input.customFields ?? []).map((f) => ({
              ...f,
              id: f.id ?? crypto.randomUUID(),
            })),
            ticketTypes: input.ticketTypes.map((tt) => ({ ...tt, capacity: tt.capacity ?? null })),
          },
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [
            {
              type: "text",
              text: `Evento creado (borrador): "${result.value.title}", id=${result.value.id}. Vista previa (solo la ves tú): ${eventUrl(result.value.slug)}. Todavía no es público: usa publish_event para enviarlo a revisión.`,
            },
          ],
        };
      },
    );

    server.registerTool(
      "set_custom_fields",
      {
        title: "Definir preguntas de registro",
        description:
          "Reemplaza las preguntas extra que se piden al comprador/asistente al registrarse " +
          "(estilo Luma: además de nombre/correo). Manda el array completo, no incremental.",
        inputSchema: {
          eventId: z.string().uuid(),
          customFields: z.array(eventCustomFieldInput).max(20),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, customFields }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const current = await findEventById(identity.organizationId, eventId);
        if (!current) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await updateEvent(
          { repo },
          eventId,
          identity.organizationId,
          {
            customFields: customFields.map((f) => ({ ...f, id: f.id ?? crypto.randomUUID() })),
          },
          current,
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [
            {
              type: "text",
              text: `Preguntas de registro actualizadas (${customFields.length}) para "${result.value.title}".`,
            },
          ],
        };
      },
    );

    server.registerTool(
      "publish_event",
      {
        title: "Publicar evento",
        description:
          "Envía el evento a revisión de Pasape (o lo publica directo si la organización es de " +
          "confianza). Sin esto el evento no es visible al público.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { destructiveHint: false },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await repo.publish(eventId, identity.organizationId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        const status = result.value.event.status;
        const url = eventUrl(result.value.event.slug);
        return {
          content: [
            {
              type: "text",
              text:
                status === "published"
                  ? `Evento publicado: ya es visible al público en ${url}.`
                  : `Evento enviado a revisión de Pasape (status=${status}). Te avisamos por correo cuando se apruebe. Vista previa (solo tú): ${url}.`,
            },
          ],
        };
      },
    );

    server.registerTool(
      "list_my_events",
      {
        title: "Listar mis eventos",
        description: "Lista los eventos de tu organización, con status y link.",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async (_input, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const events = await listEventsByOrganization({ repo }, identity.organizationId);
        if (events.length === 0) {
          return { content: [{ type: "text", text: "Todavía no tienes eventos creados." }] };
        }
        const lines = events.map(
          (e) => `- ${e.title} (${e.status}), id=${e.id}: ${eventUrl(e.slug)}`,
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "get_event_stats",
      {
        title: "Ver ventas e inscritos",
        description:
          "Cuántas entradas se vendieron/reservaron/validaron y cuánto se recaudó (neto para el " +
          "organizador, después de la comisión de Pasape), con el desglose por tipo de entrada.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const stats = await getEventStats({ repo }, eventId);
        const soles = (cents: number) => (cents / 100).toFixed(2);
        const lines = [
          `"${event.title}" — ${stats.sold} vendidas, ${stats.reserved} reservadas, ${stats.validated} validadas en puerta.`,
          `Neto para la organización: S/${soles(stats.netCents)} (bruto S/${soles(stats.revenueCents)}, comisión Pasape S/${soles(stats.serviceFeeCents)}).`,
          ...stats.ticketTypes.map(
            (t) =>
              `- ${t.name}: ${t.sold}/${t.capacity ?? "sin límite"} vendidas, ${t.validated} validadas, S/${soles(t.revenueCents)}`,
          ),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "list_event_scans",
      {
        title: "Ver feed de escaneos en la puerta",
        description:
          "Últimos escaneos de entradas en la puerta del evento: resultado (válido/ya usado/" +
          "inválido/anulado), tipo de entrada, box y hora. Útil para responder 'cuánta gente ha " +
          "entrado' el día del evento.",
        inputSchema: {
          eventId: z.string().uuid(),
          limit: z.number().int().min(1).max(200).default(50),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId, limit }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const scans = await listEventAccesos({ repo }, eventId, limit);
        if (scans.length === 0) {
          return { content: [{ type: "text", text: "Todavía no hay escaneos registrados." }] };
        }
        const lines = scans.map((s) => {
          const box = s.boxLabel ? ` (box ${s.boxLabel})` : "";
          return `- ${s.scannedAt}: ${s.ticketTypeName}${box} — ${s.result}`;
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "list_active_doorkeepers",
      {
        title: "Ver porteros conectados en la puerta",
        description:
          "Porteros con sesión activa en el evento: en qué puerta/zona están, cuándo sincronizaron " +
          "por última vez y si su sesión está desactualizada (posible fraude o dispositivo sin señal).",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const stats = await getEventStats({ repo }, eventId);
        const doors = stats.doors.filter((d) => d.holderName);
        if (doors.length === 0) {
          return { content: [{ type: "text", text: "No hay porteros con sesión activa registrada." }] };
        }
        const lines = doors.map((d) => {
          const sync =
            d.minutesSinceSync == null ? "nunca sincronizó" : `sincronizó hace ${d.minutesSinceSync} min`;
          const stale = d.isStale ? " (desactualizado)" : "";
          return `- ${d.holderName} (DNI ...${d.dniLast2 ?? "??"}) en ${d.zoneName ?? "puerta principal"}, ${sync}${stale}`;
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "list_pending_registrations",
      {
        title: "Ver inscripciones pendientes de aprobación",
        description:
          "Lista las inscripciones (RSVP con aprobación) que esperan tu decisión: aprobar o " +
          "rechazar. Solo aparecen si el tipo de entrada tiene requiresApproval=true.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await listPendingApprovalsUc({ repo: ticketRepo }, eventId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        if (result.value.length === 0) {
          return { content: [{ type: "text", text: "No hay inscripciones pendientes de aprobación." }] };
        }
        const lines = result.value.map(
          (p) =>
            `- orderId=${p.orderId} — ${p.guestName ?? "sin nombre"} (${p.guestEmail ?? p.guestPhone ?? "sin contacto"}) — ${p.ticketTypeName}` +
            (Object.keys(p.customFieldAnswers).length > 0
              ? ` — respuestas: ${JSON.stringify(p.customFieldAnswers)}`
              : ""),
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "approve_registration",
      {
        title: "Aprobar inscripción",
        description: "Aprueba una inscripción pendiente: se genera y envía el QR al asistente.",
        inputSchema: { eventId: z.string().uuid(), orderId: z.string().uuid() },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, orderId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await approveRegistrationUc({ repo: ticketRepo }, orderId, eventId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Inscripción aprobada — el QR ya se envió.` }] };
      },
    );

    server.registerTool(
      "reject_registration",
      {
        title: "Rechazar inscripción",
        description: "Rechaza una inscripción pendiente. No hay reembolso porque siempre es gratis.",
        inputSchema: { eventId: z.string().uuid(), orderId: z.string().uuid() },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, orderId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await rejectRegistrationUc({ repo: ticketRepo }, orderId, eventId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Inscripción rechazada.` }] };
      },
    );

    server.registerTool(
      "update_event",
      {
        title: "Editar evento",
        description:
          "Edita un evento ya creado (título, fecha, lugar, categoría, política de transferencias, " +
          "etc.). Solo se aplican los campos que mandes. Para cerrar/cancelar/reabrir, manda status " +
          "(draft|published|closed|cancelled).",
        inputSchema: {
          eventId: z.string().uuid(),
          title: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          venue: z.string().nullable().optional(),
          venueLat: z.number().min(-90).max(90).nullable().optional(),
          venueLng: z.number().min(-180).max(180).nullable().optional(),
          venueUrl: z.string().url().nullable().optional(),
          venueSource: z.enum(["manual", "google", "apple"]).nullable().optional(),
          startsAt: z.string().optional().describe("ISO 8601"),
          endsAt: z.string().nullable().optional(),
          timezone: z.string().optional(),
          category: z.enum(EVENT_CATEGORIES).nullable().optional(),
          totalCapacity: z.number().int().nullable().optional(),
          overbookPct: z.number().int().min(0).max(100).optional(),
          maxTicketsPerPerson: z.number().int().positive().nullable().optional(),
          transfersEnabled: z.boolean().optional(),
          transferDeadlineHours: z.number().int().nullable().optional(),
          transferMaxCount: z.number().int().min(0).optional(),
          transferRequiresKyc: z.boolean().optional(),
          feeMode: z.enum(["buyer_pays_extra", "included_in_price"]).optional(),
          status: z.enum(["draft", "published", "closed", "cancelled"]).optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, ...patch }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const current = await findEventById(identity.organizationId, eventId);
        if (!current) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await updateEvent({ repo }, eventId, identity.organizationId, patch, current);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [{ type: "text", text: `Evento actualizado: "${result.value.title}" (status=${result.value.status}).` }],
        };
      },
    );

    server.registerTool(
      "set_event_cover",
      {
        title: "Subir portada/flyer del evento",
        description:
          "Sube una imagen (foto o flyer) como portada del evento, en base64. Reemplaza la " +
          "portada anterior si ya tenía una. Formatos aceptados: JPEG, PNG, WEBP. Máximo 8MB.",
        inputSchema: {
          eventId: z.string().uuid(),
          imageBase64: z
            .string()
            .describe("Contenido de la imagen codificado en base64, sin el prefijo data:...;base64,"),
          mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, imageBase64, mimeType }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const current = await findEventById(identity.organizationId, eventId);
        if (!current) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }

        let bytes: Buffer;
        try {
          bytes = Buffer.from(imageBase64, "base64");
        } catch {
          return { content: [{ type: "text", text: "Error: imageBase64 inválido" }], isError: true };
        }
        const MAX_COVER_BYTES = 8 * 1024 * 1024;
        if (bytes.length === 0 || bytes.length > MAX_COVER_BYTES) {
          return {
            content: [{ type: "text", text: "Error: la imagen debe pesar entre 1 byte y 8MB" }],
            isError: true,
          };
        }

        const ext = mimeType.split("/")[1];
        const path = `events/${current.slug}/cover-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabaseAdmin()
          .storage.from(EVENT_ASSETS_BUCKET)
          .upload(path, bytes, { cacheControl: "3600", upsert: false, contentType: mimeType });
        if (uploadError) {
          return { content: [{ type: "text", text: `Error subiendo la imagen: ${uploadError.message}` }], isError: true };
        }
        const { data: publicUrlData } = supabaseAdmin().storage.from(EVENT_ASSETS_BUCKET).getPublicUrl(path);

        const result = await updateEvent(
          { repo },
          eventId,
          identity.organizationId,
          { coverUrl: publicUrlData.publicUrl },
          current,
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [
            {
              type: "text",
              text: `Portada actualizada. Vista previa: ${eventUrl(result.value.slug)}.`,
            },
          ],
        };
      },
    );

    server.registerTool(
      "add_ticket_type",
      {
        title: "Agregar tipo de entrada",
        description:
          "Agrega un tipo de entrada nuevo a un evento ya creado (general o box, con preventa, " +
          "liberación gratis, o RSVP con aprobación opcionales).",
        inputSchema: {
          eventId: z.string().uuid(),
          name: z.string().min(1),
          kind: z.enum(["general", "box"]).default("general"),
          priceCents: z.number().int().min(0).default(0),
          capacity: z.number().int().min(0).nullable().optional().describe("Null/ausente = sin límite (solo kind=general)."),
          boxLabel: z.string().trim().min(1).max(40).optional(),
          unitNoun: z.string().trim().max(24).nullable().optional(),
          saleEndsAt: z.string().nullable().optional(),
          description: z.string().max(300).nullable().optional(),
          presalePriceCents: z.number().int().min(0).nullable().optional(),
          presaleQty: z.number().int().min(0).nullable().optional(),
          presaleEndsAt: z.string().nullable().optional(),
          isFree: z.boolean().optional(),
          freeUntilAt: z.string().nullable().optional(),
          requiresApproval: z
            .boolean()
            .optional()
            .describe("RSVP con aprobación. Solo válido si priceCents=0."),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, ...input }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await createTicketType({ repo }, eventId, {
          ...input,
          capacity: input.capacity ?? null,
          boxLabel: input.boxLabel ?? null,
          unitNoun: input.unitNoun ?? null,
          saleEndsAt: input.saleEndsAt ?? null,
          description: input.description ?? null,
          presalePriceCents: input.presalePriceCents ?? null,
          presaleQty: input.presaleQty ?? null,
          presaleEndsAt: input.presaleEndsAt ?? null,
          isFree: input.isFree ?? false,
          freeUntilAt: input.freeUntilAt ?? null,
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Tipo de entrada creado: "${result.value.name}" — id=${result.value.id}.` }] };
      },
    );

    server.registerTool(
      "update_ticket_type",
      {
        title: "Editar tipo de entrada",
        description: "Edita un tipo de entrada existente. Solo se aplican los campos que mandes.",
        inputSchema: {
          eventId: z.string().uuid(),
          ticketTypeId: z.string().uuid(),
          name: z.string().min(1).optional(),
          priceCents: z.number().int().min(0).optional(),
          capacity: z.number().int().min(0).nullable().optional(),
          boxLabel: z.string().trim().min(1).max(40).nullable().optional(),
          unitNoun: z.string().trim().max(24).nullable().optional(),
          saleEndsAt: z.string().nullable().optional(),
          description: z.string().max(300).nullable().optional(),
          presalePriceCents: z.number().int().min(0).nullable().optional(),
          presaleQty: z.number().int().min(0).nullable().optional(),
          presaleEndsAt: z.string().nullable().optional(),
          isFree: z.boolean().optional(),
          freeUntilAt: z.string().nullable().optional(),
          requiresApproval: z.boolean().optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, ticketTypeId, ...patch }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await updateTicketType({ repo }, eventId, ticketTypeId, patch);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Tipo de entrada actualizado: "${result.value.name}".` }] };
      },
    );

    server.registerTool(
      "delete_ticket_type",
      {
        title: "Borrar tipo de entrada",
        description: "Borra un tipo de entrada. Solo funciona si todavía no tiene ventas.",
        inputSchema: { eventId: z.string().uuid(), ticketTypeId: z.string().uuid() },
        annotations: { destructiveHint: true },
      },
      async ({ eventId, ticketTypeId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await deleteTicketType({ repo }, eventId, ticketTypeId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Tipo de entrada borrado.` }] };
      },
    );

    server.registerTool(
      "set_promos",
      {
        title: "Configurar promociones",
        description:
          "Reemplaza las promociones (2x1/3x2) del evento con la lista que mandes (una por tipo de " +
          "entrada — la última gana). Manda el array completo, no incremental.",
        inputSchema: {
          eventId: z.string().uuid(),
          promos: z.array(
            z.object({
              ticketTypeId: z.string().uuid(),
              kind: z.enum(["2x1", "3x2"]),
              endsAt: z.string().nullable().optional(),
            }),
          ),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, promos }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await repo.setPromos(eventId, promos);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `${result.value.length} promoción(es) activa(s).` }] };
      },
    );

    server.registerTool(
      "list_promos",
      {
        title: "Ver promociones",
        description: "Lista las promociones (2x1/3x2) activas del evento.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const found = await repo.getBySlug(event.slug);
        if (!found || found.promos.length === 0) {
          return { content: [{ type: "text", text: "Sin promociones activas." }] };
        }
        const lines = found.promos.map(
          (p) => `- ${p.kind} — ticketTypeId=${p.ticketTypeId}${p.endsAt ? ` — vence ${p.endsAt}` : ""}`,
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "list_courtesies",
      {
        title: "Ver cortesías enviadas",
        description: "Lista las cortesías (entradas regaladas) enviadas para este evento.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await listCourtesiesUc({ repo: ticketRepo }, eventId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        if (result.value.length === 0) {
          return { content: [{ type: "text", text: "Sin cortesías enviadas todavía." }] };
        }
        const lines = result.value.map(
          (c) =>
            `- ${c.guestName ?? "sin nombre"} (${c.guestEmail ?? c.guestPhone ?? "sin contacto"}) — ` +
            `${c.ticketTypeName}${c.boxLabel ? ` (${c.boxLabel})` : ""} — ${c.usedCount > 0 ? "ingresó" : "enviada"}`,
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "send_courtesy",
      {
        title: "Enviar cortesía",
        description:
          "Regala una entrada o box a alguien (cumpleañeros, prensa, auspiciadores). Necesita un " +
          "email o teléfono de contacto para mandarle el QR.",
        inputSchema: {
          eventId: z.string().uuid(),
          ticketTypeId: z.string().uuid(),
          qty: z.number().int().min(1).max(10).default(1),
          guestFullName: z.string().trim().min(2).max(120),
          guestEmail: z.string().trim().email().nullable().optional(),
          guestPhone: z.string().trim().min(6).max(20).nullable().optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, ticketTypeId, qty, guestFullName, guestEmail, guestPhone }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        if (!guestEmail && !guestPhone) {
          return { content: [{ type: "text", text: "Error: contact_required (manda guestEmail o guestPhone)" }], isError: true };
        }
        const result = await issueCourtesyUc(
          { repo: ticketRepo },
          {
            eventId,
            ticketTypeId,
            qty,
            guest: { fullName: guestFullName, email: guestEmail ?? null, phone: guestPhone ?? null },
          },
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Cortesía enviada a ${guestFullName} — orderId=${result.value.order.id}.` }] };
      },
    );

    server.registerTool(
      "generate_door_link",
      {
        title: "Generar link de puerta",
        description:
          "Genera (o reusa) el link + código corto para que tu portero escanee QRs en la entrada.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { destructiveHint: false },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const link = await generateDoorLink(event, appOrigin());
        return {
          content: [
            {
              type: "text",
              text: `Link de puerta: ${link.url}\nCódigo: ${link.code}`,
            },
          ],
        };
      },
    );

    server.registerTool(
      "list_event_zones",
      {
        title: "Listar puertas/zonas del evento",
        description:
          "Lista las puertas (zonas) del evento. La puerta principal valida cualquier entrada; " +
          "las custom solo validan los tipos de entrada que se les asignen (útil para eventos con " +
          "varios ingresos, ej. VIP aparte de general).",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const zones = await listZones(eventId);
        const lines = zones.map(
          (z) =>
            `- ${z.name}${z.isDefault ? " (principal, valida todo)" : ""}: id=${z.id}` +
            (z.isDefault ? "" : `, entradas=[${z.ticketTypeIds.join(", ") || "ninguna"}]`),
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "create_event_zone",
      {
        title: "Crear puerta/zona",
        description:
          "Crea una puerta custom en el evento, que solo valida los tipos de entrada que le asignes " +
          "(usa list_event_zones para ver los ticketTypeIds disponibles). Solo puede haber una " +
          "puerta principal por evento.",
        inputSchema: {
          eventId: z.string().uuid(),
          name: z.string().min(1).max(60),
          ticketTypeIds: z.array(z.string().uuid()).default([]),
          isDefault: z.boolean().optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, name, ticketTypeIds, isDefault }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await createZone(eventId, { name, ticketTypeIds, isDefault });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Puerta creada: "${result.value.name}" (id=${result.value.id}).` }] };
      },
    );

    server.registerTool(
      "update_event_zone",
      {
        title: "Editar puerta/zona",
        description: "Renombra una puerta o cambia qué tipos de entrada valida.",
        inputSchema: {
          eventId: z.string().uuid(),
          zoneId: z.string().uuid(),
          name: z.string().min(1).max(60).optional(),
          ticketTypeIds: z.array(z.string().uuid()).optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, zoneId, name, ticketTypeIds }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await updateZone(eventId, zoneId, { name, ticketTypeIds });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Puerta actualizada: "${result.value.name}".` }] };
      },
    );

    server.registerTool(
      "delete_event_zone",
      {
        title: "Eliminar puerta/zona",
        description:
          "Elimina una puerta custom. No se puede eliminar si es la única puerta que le queda al " +
          "evento.",
        inputSchema: { eventId: z.string().uuid(), zoneId: z.string().uuid() },
        annotations: { destructiveHint: true },
      },
      async ({ eventId, zoneId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await deleteZone(eventId, zoneId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: "Puerta eliminada." }] };
      },
    );

    server.registerTool(
      "list_event_team",
      {
        title: "Ver equipo del evento",
        description:
          "Lista los co-organizadores asignados solo a este evento (no incluye gente con acceso " +
          "heredado de la marca — eso se gestiona desde la web en Equipo de la marca).",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const team = await listEventCoOrganizers(eventId);
        if (team.length === 0) {
          return { content: [{ type: "text", text: "Sin co-organizadores agregados a este evento todavía." }] };
        }
        const lines = team.map((m) => `- ${m.fullName ?? m.email ?? m.profileId} (profileId=${m.profileId})`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "remove_co_organizer",
      {
        title: "Quitar co-organizador del evento",
        description:
          "Quita a alguien de los co-organizadores de este evento (no afecta su acceso heredado de " +
          "la marca, si lo tiene). Necesita el profileId — sácalo de list_event_team.",
        inputSchema: { eventId: z.string().uuid(), profileId: z.string().uuid() },
        annotations: { destructiveHint: true },
      },
      async ({ eventId, profileId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await removeEventCoOrganizer(eventId, profileId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Co-organizador quitado del evento.` }] };
      },
    );

    server.registerTool(
      "invite_event_co_organizer",
      {
        title: "Invitar co-organizador solo de este evento",
        description:
          "Invita por email a alguien como co-organizador de ESTE evento puntual, sin volverlo " +
          "miembro de toda tu marca (para eso usa invite_org_co_organizer). Le llega un correo con " +
          "un link; al aceptar queda como co-organizador solo de este evento. Revisa quién ya está " +
          "con list_event_team.",
        inputSchema: { eventId: z.string().uuid(), email: z.string().email() },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, email }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await inviteEventCoOrganizer(
          { invites: supabaseInviteRepository, memberships: supabaseMembershipRepository },
          {
            eventId,
            organizationId: identity.organizationId,
            callerProfileId: identity.createdBy,
            email,
          },
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        const inviter = await supabaseUserRepository.findById(identity.createdBy);
        const inviteUrl = await buildInviteUrl(result.value.token);
        await dispatchTeamInviteNotification({
          channel: "email",
          destination: result.value.email,
          token: result.value.token,
          inviteUrl,
          expiresAt: result.value.expiresAt,
          role: "editor",
          scopeLabel: `Evento: ${event.title}`,
          inviterName: inviter?.fullName ?? null,
        });
        return { content: [{ type: "text", text: `Invitación enviada a ${email} para este evento.` }] };
      },
    );

    server.registerTool(
      "invite_org_co_organizer",
      {
        title: "Invitar miembro a toda la marca",
        description:
          "Invita por email a alguien como miembro de TODA tu marca (todos los eventos, no uno " +
          "puntual — para eso usa invite_event_co_organizer). Roles: admin (gestiona todo salvo " +
          "razón social/datos bancarios), editor (crea/edita eventos), reporter (solo ve reportes).",
        inputSchema: {
          email: z.string().email(),
          role: z.enum(["admin", "editor", "reporter"]),
        },
        annotations: { destructiveHint: false },
      },
      async ({ email, role }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await createInvite(
          { invites: supabaseInviteRepository, memberships: supabaseMembershipRepository },
          {
            scope: { type: "organization", id: identity.organizationId },
            callerProfileId: identity.createdBy,
            email,
            phone: null,
            role,
          },
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        const inviter = await supabaseUserRepository.findById(identity.createdBy);
        const inviteUrl = await buildInviteUrl(result.value.token);
        await dispatchTeamInviteNotification({
          channel: "email",
          destination: email,
          token: result.value.token,
          inviteUrl,
          expiresAt: result.value.expiresAt,
          role,
          scopeLabel: "Marca completa",
          inviterName: inviter?.fullName ?? null,
        });
        return { content: [{ type: "text", text: `Invitación enviada a ${email} como ${role} de la marca.` }] };
      },
    );

    server.registerTool(
      "update_organization",
      {
        title: "Editar marca (branding)",
        description:
          "Edita el nombre, slug, bio/descripción, Instagram o logo de tu marca. Para razón social " +
          "(nombre legal/RUC) usa update_legal_entity — son datos distintos.",
        inputSchema: {
          name: z.string().min(1).max(80).optional(),
          slug: z.string().min(3).max(60).optional(),
          logoUrl: z.string().url().nullable().optional(),
          brandColor: z.string().nullable().optional(),
          description: z.string().max(280).nullable().optional(),
          instagram: z.string().nullable().optional(),
        },
        annotations: { destructiveHint: false },
      },
      async (patch, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await supabaseOrganizationRepository.update({
          id: identity.organizationId,
          callerId: identity.createdBy,
          ...patch,
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Marca actualizada: "${result.value.name}".` }] };
      },
    );

    server.registerTool(
      "update_legal_entity",
      {
        title: "Editar razón social",
        description:
          "Edita la razón social de tu marca: nombre legal, RUC/DNI, país, y los datos de la " +
          "vitrina pública (nombre a mostrar, bio, logo, portada). NO maneja datos bancarios — " +
          "esos solo se editan desde la web, por seguridad.",
        inputSchema: {
          name: z.string().min(1).max(120).optional(),
          taxId: z.string().max(20).nullable().optional().describe("RUC o DNI."),
          country: z.string().length(2).optional().describe("Código ISO de país, ej. PE."),
          slug: z.string().max(60).nullable().optional(),
          displayName: z.string().max(80).nullable().optional(),
          logoUrl: z.string().url().nullable().optional(),
          coverUrl: z.string().url().nullable().optional(),
          bio: z.string().max(500).nullable().optional(),
        },
        annotations: { destructiveHint: false },
      },
      async (patch, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const orgs = await supabaseOrganizationRepository.listByMember(identity.createdBy);
        const org = orgs.find((o) => o.id === identity.organizationId);
        if (!org) {
          return { content: [{ type: "text", text: "Error: organización no encontrada" }], isError: true };
        }
        const result = await supabaseLegalEntityRepository.update({
          id: org.legalEntityId,
          callerId: identity.createdBy,
          ...patch,
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Razón social actualizada: "${result.value.name}".` }] };
      },
    );

    server.registerTool(
      "list_promoters",
      {
        title: "Ver pool de promotores",
        description: "Lista los promotores de tu marca (pool completo, no solo los de un evento).",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async (_input, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const promoters = await orgPromoterRepo.listByOrg(identity.organizationId);
        if (promoters.length === 0) {
          return { content: [{ type: "text", text: "Sin promotores creados todavía." }] };
        }
        const lines = promoters.map(
          (p) => `- ${p.name} (id=${p.id})${p.whatsapp ? ` — ${p.whatsapp}` : ""}${p.defaultCommissionPct != null ? ` — ${p.defaultCommissionPct}% default` : ""}`,
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    const milestoneInput = z
      .object({
        threshold: z.number().int().min(1).describe("Umbral (según basis) que dispara el premio."),
        rewardKind: z.enum(["cash", "perk"]),
        amountCents: z
          .number()
          .int()
          .min(0)
          .nullable()
          .optional()
          .describe("Solo para rewardKind=cash. Null/ausente para perk."),
        label: z.string().min(1).max(120).describe("Ej. 'Botella de cortesía', 'S/100 extra'."),
      })
      .refine((m) => m.rewardKind !== "cash" || m.amountCents != null, {
        message: "Un hito 'cash' necesita amountCents",
        path: ["amountCents"],
      });

    // Reusado por create_promoter, update_promoter, set_org_promoter_scheme,
    // set_event_promoter_scheme y update_promoter_assignment — todos reciben
    // milestoneBasis/milestones con la misma forma y construyen el mismo
    // CommissionConfig.
    type MilestoneInputRow = z.infer<typeof milestoneInput>;
    const buildCommissionConfig = (
      milestoneBasis: "sold" | "attended" | undefined,
      milestones: MilestoneInputRow[] | undefined,
    ): CommissionConfig =>
      milestones && milestones.length > 0
        ? {
            basis: milestoneBasis!,
            milestones: milestones.map((m) => ({
              threshold: m.threshold,
              rewardKind: m.rewardKind,
              amountCents: m.rewardKind === "cash" ? (m.amountCents ?? null) : null,
              label: m.label,
            })),
          }
        : null;

    server.registerTool(
      "create_promoter",
      {
        title: "Crear promotor",
        description:
          "Crea un promotor nuevo en el pool de tu marca (todavía no vende ningún evento — usa " +
          "assign_promoter_to_event para eso). Cubre comisión simple (%) y, opcionalmente, hitos " +
          "por metas (efectivo o especie) sobre entradas vendidas o gente que asistió.",
        inputSchema: {
          name: z.string().min(1).max(80),
          whatsapp: z.string().min(6).max(32).nullable().optional(),
          defaultCommissionPct: z
            .number()
            .int()
            .min(0)
            .max(100)
            .nullable()
            .optional()
            .describe("Null = hereda el % default de la marca."),
          milestoneBasis: z
            .enum(["sold", "attended"])
            .optional()
            .describe(
              "Sobre qué se cuenta el avance de los hitos: 'sold' = entradas vendidas, " +
                "'attended' = gente que efectivamente entró (valida en puerta). Requerido si " +
                "mandas milestones.",
            ),
          milestones: z
            .array(milestoneInput)
            .max(10)
            .optional()
            .describe("Metas por umbral. Si mandas esto, milestoneBasis es obligatorio."),
        },
        annotations: { destructiveHint: false },
      },
      async ({ name, whatsapp, defaultCommissionPct, milestoneBasis, milestones }, extra) => {
        if (milestones && milestones.length > 0 && !milestoneBasis) {
          return {
            content: [{ type: "text", text: "Error: milestoneBasis es obligatorio si mandas milestones" }],
            isError: true,
          };
        }
        const identity = identityFromAuth(extra.authInfo);
        const result = await orgPromoterRepo.create({
          organizationId: identity.organizationId,
          createdBy: identity.createdBy,
          name: name.trim(),
          whatsapp: whatsapp ?? null,
          defaultCommissionPct: defaultCommissionPct ?? null,
          commissionConfig:
            milestones && milestones.length > 0
              ? {
                  basis: milestoneBasis!,
                  milestones: milestones.map((m) => ({
                    threshold: m.threshold,
                    rewardKind: m.rewardKind,
                    amountCents: m.rewardKind === "cash" ? (m.amountCents ?? null) : null,
                    label: m.label,
                  })),
                }
              : null,
          notes: null,
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Promotor creado: "${result.value.name}" — id=${result.value.id}.` }] };
      },
    );

    server.registerTool(
      "update_promoter",
      {
        title: "Editar promotor del pool",
        description:
          "Edita nombre, whatsapp, comisión default o hitos de un promotor del pool de tu marca. " +
          "Solo se aplican los campos que mandes.",
        inputSchema: {
          promoterId: z.string().uuid(),
          name: z.string().min(1).max(80).optional(),
          whatsapp: z.string().min(6).max(32).nullable().optional(),
          defaultCommissionPct: z.number().int().min(0).max(100).nullable().optional(),
          milestoneBasis: z.enum(["sold", "attended"]).optional(),
          milestones: z.array(milestoneInput).max(10).optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ promoterId, milestoneBasis, milestones, ...patch }, extra) => {
        if (milestones && milestones.length > 0 && !milestoneBasis) {
          return {
            content: [{ type: "text", text: "Error: milestoneBasis es obligatorio si mandas milestones" }],
            isError: true,
          };
        }
        const identity = identityFromAuth(extra.authInfo);
        const result = await orgPromoterRepo.update(promoterId, identity.organizationId, {
          ...patch,
          ...(milestones !== undefined
            ? { commissionConfig: buildCommissionConfig(milestoneBasis, milestones) }
            : {}),
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `Promotor actualizado: "${result.value.name}".` }] };
      },
    );

    server.registerTool(
      "delete_promoter",
      {
        title: "Eliminar promotor del pool",
        description:
          "Elimina un promotor del pool de tu marca. No borra su historial de ventas pasadas, solo " +
          "lo saca del pool para asignaciones futuras.",
        inputSchema: { promoterId: z.string().uuid() },
        annotations: { destructiveHint: true },
      },
      async ({ promoterId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await orgPromoterRepo.softDelete(promoterId, identity.organizationId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: "Promotor eliminado del pool." }] };
      },
    );

    server.registerTool(
      "get_promoter_dashboard",
      {
        title: "Ver dashboard de un promotor",
        description:
          "Ventas, entradas validadas y comisión acumulada de un promotor, sumado across todos los " +
          "eventos donde vendió (no solo uno).",
        inputSchema: { promoterId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ promoterId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const promoter = await orgPromoterRepo.findById(promoterId);
        if (!promoter || promoter.organizationId !== identity.organizationId) {
          return { content: [{ type: "text", text: "Error: promotor no encontrado" }], isError: true };
        }
        const detail = await getOrgPromoterDetail(promoter, appOrigin());
        const soles = (cents: number) => (cents / 100).toFixed(2);
        const lines = [
          `"${promoter.name}": ${detail.totals.eventsCount} eventos, ${detail.totals.ticketsSold} vendidas, ` +
            `${detail.totals.ticketsValidated} validadas, S/${soles(detail.totals.revenueCents)} en ventas, ` +
            `S/${soles(detail.totals.commissionCents)} de comisión acumulada.`,
          ...detail.byEvent.map(
            (e) =>
              `- ${e.eventTitle}: ${e.ticketsSold} vendidas, S/${soles(e.grossCents)}, comisión S/${soles(e.commissionCents)} (${e.commissionPct}%)`,
          ),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "get_org_promoter_scheme",
      {
        title: "Ver esquema de comisión default de la marca",
        description:
          "Ve el % y los hitos de comisión que aplican por default a todos los promotores y " +
          "eventos de tu marca (cada promotor/evento puede tener su propio override).",
        inputSchema: {},
        annotations: { readOnlyHint: true },
      },
      async (_input, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const { data } = await supabaseAdmin()
          .from("organizations")
          .select("promoter_commission_pct, promoter_commission_config")
          .eq("id", identity.organizationId)
          .maybeSingle<{ promoter_commission_pct: number | null; promoter_commission_config: unknown }>();
        const config = coerceCommissionConfig(data?.promoter_commission_config);
        const lines = [
          `Comisión default de marca: ${data?.promoter_commission_pct ?? "sin definir"}%.`,
          config
            ? `Hitos (${config.basis}): ${config.milestones.map((m) => `${m.threshold} → ${m.label}`).join(", ")}`
            : "Sin hitos default.",
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "set_org_promoter_scheme",
      {
        title: "Definir esquema de comisión default de la marca",
        description:
          "Define el % y/o los hitos de comisión default para todos los promotores/eventos de tu " +
          "marca. Un evento u promotor puntual puede seguir teniendo su propio override.",
        inputSchema: {
          commissionPct: z.number().int().min(0).max(100).nullable().optional(),
          milestoneBasis: z.enum(["sold", "attended"]).optional(),
          milestones: z.array(milestoneInput).max(10).optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ commissionPct, milestoneBasis, milestones }, extra) => {
        if (milestones && milestones.length > 0 && !milestoneBasis) {
          return {
            content: [{ type: "text", text: "Error: milestoneBasis es obligatorio si mandas milestones" }],
            isError: true,
          };
        }
        const identity = identityFromAuth(extra.authInfo);
        const row: Record<string, unknown> = {};
        if (commissionPct !== undefined) row.promoter_commission_pct = commissionPct;
        if (milestones !== undefined) row.promoter_commission_config = buildCommissionConfig(milestoneBasis, milestones);
        if (Object.keys(row).length === 0) {
          return { content: [{ type: "text", text: "Nada que actualizar." }] };
        }
        const { error } = await supabaseAdmin()
          .from("organizations")
          .update(row)
          .eq("id", identity.organizationId);
        if (error) {
          return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
        }
        return { content: [{ type: "text", text: "Esquema de comisión de marca actualizado." }] };
      },
    );

    server.registerTool(
      "list_event_promoters",
      {
        title: "Ver promotores asignados a un evento",
        description: "Lista los promotores asignados a este evento, con su link y ventas.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const assigned = await listAssignmentsForEvent(eventId, appOrigin());
        if (assigned.length === 0) {
          return { content: [{ type: "text", text: "Sin promotores asignados a este evento." }] };
        }
        const lines = assigned.map(
          (a) =>
            `- ${a.name} — ${a.effectiveCommissionPct}% — ${a.url}${a.active ? "" : " (desactivado)"}` +
            ` — linkId=${a.promoterLinkId}`,
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "assign_promoter_to_event",
      {
        title: "Asignar promotor a un evento",
        description: "Asigna uno o más promotores de tu pool a este evento, para que puedan vender con su link.",
        inputSchema: { eventId: z.string().uuid(), orgPromoterIds: z.array(z.string().uuid()).min(1) },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, orgPromoterIds }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await assignOrgPromotersToEvent(eventId, identity.organizationId, orgPromoterIds);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: `${result.value.length} promotor(es) asignado(s) al evento.` }] };
      },
    );

    server.registerTool(
      "get_event_promoter_scheme",
      {
        title: "Ver esquema de comisión del evento",
        description:
          "Ve el % de comisión, hitos y cupo default que aplican a los promotores de ESTE evento " +
          "(override del esquema de marca). Campos en null = hereda el default de la marca.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const scheme = await repo.getPromoterScheme(eventId);
        const lines = [
          `Comisión: ${scheme.commissionPct ?? "hereda de la marca"}%.`,
          `Cupo default por promotor: ${scheme.defaultQuota ?? "sin tope"}.`,
          scheme.commissionConfig
            ? `Hitos (${scheme.commissionConfig.basis}): ${scheme.commissionConfig.milestones.map((m) => `${m.threshold} → ${m.label}`).join(", ")}`
            : "Sin hitos propios (hereda de la marca).",
        ];
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "set_event_promoter_scheme",
      {
        title: "Definir esquema de comisión del evento",
        description:
          "Define el % de comisión, hitos y/o cupo default de los promotores para ESTE evento, " +
          "sobreescribiendo el default de la marca solo para este evento.",
        inputSchema: {
          eventId: z.string().uuid(),
          commissionPct: z.number().int().min(0).max(100).nullable().optional(),
          defaultQuota: z.number().int().positive().nullable().optional(),
          milestoneBasis: z.enum(["sold", "attended"]).optional(),
          milestones: z.array(milestoneInput).max(10).optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, commissionPct, defaultQuota, milestoneBasis, milestones }, extra) => {
        if (milestones && milestones.length > 0 && !milestoneBasis) {
          return {
            content: [{ type: "text", text: "Error: milestoneBasis es obligatorio si mandas milestones" }],
            isError: true,
          };
        }
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const patch: Partial<EventPromoterScheme> = {};
        if (commissionPct !== undefined) patch.commissionPct = commissionPct;
        if (defaultQuota !== undefined) patch.defaultQuota = defaultQuota;
        if (milestones !== undefined) patch.commissionConfig = buildCommissionConfig(milestoneBasis, milestones);
        const result = await repo.updatePromoterScheme(eventId, patch);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: "Esquema de comisión del evento actualizado." }] };
      },
    );

    server.registerTool(
      "update_promoter_assignment",
      {
        title: "Personalizar comisión de una asignación puntual",
        description:
          "Cambia la comisión, hitos o cupo de UN promotor en UN evento puntual (usa el linkId que " +
          "devuelve list_event_promoters), sin afectar el esquema general del evento ni de la marca.",
        inputSchema: {
          eventId: z.string().uuid(),
          promoterLinkId: z.string().uuid(),
          commissionPct: z.number().int().min(0).max(100).nullable().optional(),
          quota: z.number().int().positive().nullable().optional(),
          milestoneBasis: z.enum(["sold", "attended"]).optional(),
          milestones: z.array(milestoneInput).max(10).optional(),
        },
        annotations: { destructiveHint: false },
      },
      async ({ eventId, promoterLinkId, commissionPct, quota, milestoneBasis, milestones }, extra) => {
        if (milestones && milestones.length > 0 && !milestoneBasis) {
          return {
            content: [{ type: "text", text: "Error: milestoneBasis es obligatorio si mandas milestones" }],
            isError: true,
          };
        }
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await updateAssignmentCommission(promoterLinkId, eventId, {
          commissionPct,
          quota,
          ...(milestones !== undefined
            ? { commissionConfig: buildCommissionConfig(milestoneBasis, milestones) }
            : {}),
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: "Asignación actualizada." }] };
      },
    );

    server.registerTool(
      "remove_promoter_from_event",
      {
        title: "Quitar promotor de un evento",
        description:
          "Quita a un promotor de este evento (usa el linkId de list_event_promoters). Si ya tiene " +
          "ventas pagadas, se desactiva en vez de borrarse, para no perder el historial.",
        inputSchema: { eventId: z.string().uuid(), promoterLinkId: z.string().uuid() },
        annotations: { destructiveHint: true },
      },
      async ({ eventId, promoterLinkId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const result = await removeAssignment(promoterLinkId, eventId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return { content: [{ type: "text", text: "Promotor quitado del evento." }] };
      },
    );

    server.registerTool(
      "list_promoter_applications",
      {
        title: "Ver solicitudes de promotores pendientes",
        description:
          "Lista las solicitudes de gente que pidió ser promotor de este evento (alta por link de " +
          "grupo), pendientes de tu aprobación.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const applications = await listPendingApplications(
          { repo: supabasePromoterRepository },
          event.slug,
          identity.organizationId,
        );
        if (applications.length === 0) {
          return { content: [{ type: "text", text: "Sin solicitudes pendientes." }] };
        }
        const lines = applications.map(
          (a) => `- ${a.applicantName}${a.applicantHandle ? ` (@${a.applicantHandle})` : ""}: id=${a.id}` +
            (a.message ? ` — "${a.message}"` : ""),
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      },
    );

    server.registerTool(
      "decide_promoter_application",
      {
        title: "Aprobar o rechazar solicitud de promotor",
        description: "Aprueba o rechaza una solicitud de alta de promotor (usa el id de list_promoter_applications).",
        inputSchema: {
          applicationId: z.string().uuid(),
          decision: z.enum(["approved", "rejected"]),
          commissionPct: z
            .number()
            .int()
            .min(0)
            .max(100)
            .nullable()
            .optional()
            .describe("Solo aplica si decision=approved. Null = hereda el default de la marca."),
        },
        annotations: { destructiveHint: false },
      },
      async ({ applicationId, decision, commissionPct }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await decideApplication(
          { repo: supabasePromoterRepository },
          {
            applicationId,
            decidedBy: identity.createdBy,
            orgId: identity.organizationId,
            decision,
            commissionPct,
          },
        );
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        return {
          content: [
            { type: "text", text: decision === "approved" ? "Solicitud aprobada." : "Solicitud rechazada." },
          ],
        };
      },
    );

    server.registerTool(
      "export_attendees",
      {
        title: "Exportar asistentes (Excel)",
        description:
          "Genera el reporte de asistentes/ventas del evento en Excel (.xlsx) y lo devuelve como " +
          "archivo adjunto en la respuesta.",
        inputSchema: { eventId: z.string().uuid() },
        annotations: { readOnlyHint: true },
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const event = await findEventById(identity.organizationId, eventId);
        if (!event) {
          return { content: [{ type: "text", text: "Error: evento no encontrado" }], isError: true };
        }
        const { buffer, filename } = await exportEventReport({ repo }, event);
        return {
          content: [
            { type: "text", text: `Reporte de "${event.title}" listo: ${filename}.` },
            {
              type: "resource",
              resource: {
                uri: `pasape://events/${eventId}/export.xlsx`,
                mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                blob: buffer.toString("base64"),
              },
            },
          ],
        };
      },
    );
  },
  {
    // Va en la respuesta de "initialize" y muchos clientes (Claude.ai
    // incluido) se lo muestran al modelo como contexto del servidor — sin
    // esto, visto en vivo: el modelo respondía "no tengo acceso a un sistema
    // de eventos, usa Eventbrite" en vez de usar estos tools, hasta que el
    // usuario le dijo explícitamente "usa el MCP de Pasape".
    instructions:
      "Este servidor SÍ puede crear y gestionar eventos reales en Pasape (Perú): crear evento, " +
      "definir entradas/precios, publicarlo, ver estadísticas, aprobar inscripciones, subir la " +
      "portada/flyer del evento (set_event_cover, recibe la imagen en base64), etc. Si el " +
      "usuario quiere crear, publicar o gestionar un evento, usa estos tools directamente — no " +
      "sugieras Eventbrite, Facebook Events ni otra plataforma externa. create_event lo deja en " +
      "borrador (nadie lo ve salvo el organizador); publish_event lo hace público. Cada tool que " +
      "devuelve un evento incluye su link real, pásaselo siempre al usuario tal cual, sin inventar " +
      "ni adivinar la URL. También cubre: puertas/zonas de acceso, feed de escaneos y porteros en " +
      "vivo, promotores (pool, comisiones, hitos, esquema por marca/evento/asignación, solicitudes " +
      "de alta), equipo (co-organizadores por evento o de toda la marca), y branding/razón social " +
      "de la organización. Los datos bancarios NO se manejan por MCP, solo desde la web.",
  },
  { basePath: "/api", verboseLogs: process.env.NODE_ENV !== "production" },
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  // Vía principal: access token OAuth emitido por /api/oauth/token.
  const viaOAuth = await verifyAccessToken(bearerToken);
  if (viaOAuth.ok) {
    return {
      token: bearerToken,
      clientId: "oauth",
      scopes: ["events:write"],
      extra: viaOAuth.value,
    };
  }

  // Fallback: API key manual (pk_live_...), para scripts/debug — no la UI
  // que ve un organizador casual.
  const viaApiKey = await verifyApiKey(bearerToken);
  if (viaApiKey.ok) {
    return {
      token: bearerToken,
      clientId: viaApiKey.value.apiKeyId,
      scopes: ["events:write"],
      extra: viaApiKey.value,
    };
  }

  return undefined;
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

// mcp-handler solo agrega CORS a los endpoints .well-known (metadataCorsOptionsRequestHandler) —
// este endpoint principal se queda sin cabeceras y sin handler de OPTIONS. Un cliente MCP basado
// en navegador (Claude.ai web, el webview de Claude Desktop) manda un preflight OPTIONS antes del
// POST real; sin este export, Next.js responde 405 Method Not Allowed automáticamente y la
// conexión nunca llega a intentar el POST. Ver también CORS_HEADERS en los .well-known.
const MCP_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

const withCors = (
  fn: (req: Request) => Promise<Response>,
) => async (req: Request) => {
  const res = await fn(req);
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(MCP_CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
};

export const OPTIONS = () => new Response(null, { status: 204, headers: MCP_CORS_HEADERS });
export const GET = withCors(authHandler);
export const POST = withCors(authHandler);
export const DELETE = withCors(authHandler);
