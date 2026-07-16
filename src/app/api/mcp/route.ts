import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { z } from "zod";
import { verifyApiKey } from "@/server/identity/apiKeys/application/VerifyApiKey";
import { verifyAccessToken } from "@/server/identity/oauth/application/VerifyAccessToken";
import { createEvent } from "@/server/events/application/CreateEvent";
import { updateEvent } from "@/server/events/application/UpdateEvent";
import { listEventsByOrganization } from "@/server/events/application/ListEventsByOrganization";
import { getEventStats } from "@/server/events/application/GetEventStats";
import { supabaseEventRepository as repo } from "@/server/events/infrastructure/repositories/SupabaseEventRepository";
import { customFieldObjectSchema, withSelectOptionsRule } from "@/lib/events/customFields";
import type { ApiKeyIdentity } from "@/server/identity/apiKeys/domain/ApiKey";

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
  })
  .refine((v) => v.kind !== "box" || v.capacity != null, {
    message: "Un box necesita capacity (asientos) — no puede ser sin límite",
    path: ["capacity"],
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
          ticketTypes: z
            .array(ticketTypeInput)
            .min(1)
            .describe("Al menos un tipo de entrada. Para RSVP gratis: priceCents=0."),
          customFields: z
            .array(eventCustomFieldInput)
            .optional()
            .describe("Preguntas extra de registro, estilo Luma (ver add_custom_fields)."),
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
