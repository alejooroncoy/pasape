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
              text: `Evento creado (borrador): "${result.value.title}" — id=${result.value.id}, slug=${result.value.slug}. Todavía no es público: usa publish_event para enviarlo a revisión.`,
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
      },
      async ({ eventId }, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const result = await repo.publish(eventId, identity.organizationId);
        if (!result.ok) {
          return { content: [{ type: "text", text: `Error: ${result.error}` }], isError: true };
        }
        const status = result.value.event.status;
        return {
          content: [
            {
              type: "text",
              text:
                status === "published"
                  ? `Evento publicado: ya es visible al público.`
                  : `Evento enviado a revisión de Pasape (status=${status}). Te avisamos por correo cuando se apruebe.`,
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
      },
      async (_input, extra) => {
        const identity = identityFromAuth(extra.authInfo);
        const events = await listEventsByOrganization({ repo }, identity.organizationId);
        if (events.length === 0) {
          return { content: [{ type: "text", text: "Todavía no tienes eventos creados." }] };
        }
        const lines = events.map(
          (e) => `- ${e.title} (${e.status}) — id=${e.id}, slug=${e.slug}`,
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
      "list_pending_registrations",
      {
        title: "Ver inscripciones pendientes de aprobación",
        description:
          "Lista las inscripciones (RSVP con aprobación) que esperan tu decisión: aprobar o " +
          "rechazar. Solo aparecen si el tipo de entrada tiene requiresApproval=true.",
        inputSchema: { eventId: z.string().uuid() },
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
      "list_event_team",
      {
        title: "Ver equipo del evento",
        description:
          "Lista los co-organizadores asignados solo a este evento (no incluye gente con acceso " +
          "heredado de la marca — eso se gestiona desde la web en Equipo de la marca).",
        inputSchema: { eventId: z.string().uuid() },
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
          "miembro de toda tu marca (a diferencia de invitar al equipo de marca — eso no existe " +
          "todavía por MCP). Le llega un correo con un link; al aceptar queda como co-organizador " +
          "solo de este evento. Revisa quién ya está con list_event_team.",
        inputSchema: { eventId: z.string().uuid(), email: z.string().email() },
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
      "list_promoters",
      {
        title: "Ver pool de promotores",
        description: "Lista los promotores de tu marca (pool completo, no solo los de un evento).",
        inputSchema: {},
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
      "list_event_promoters",
      {
        title: "Ver promotores asignados a un evento",
        description: "Lista los promotores asignados a este evento, con su link y ventas.",
        inputSchema: { eventId: z.string().uuid() },
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
          (a) => `- ${a.name} — ${a.effectiveCommissionPct}% — ${a.url}${a.active ? "" : " (desactivado)"}`,
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
      "export_attendees",
      {
        title: "Exportar asistentes (Excel)",
        description:
          "Genera el reporte de asistentes/ventas del evento en Excel (.xlsx) y lo devuelve como " +
          "archivo adjunto en la respuesta.",
        inputSchema: { eventId: z.string().uuid() },
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
  {},
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

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
