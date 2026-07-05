import { z } from "zod";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseTicketRepository } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
import { scanQr } from "../../application/ScanQr";
import { admitTicket } from "../../application/AdmitTicket";
import {
  verifyScanAccess,
  type ScanAccessContext,
} from "../../application/VerifyScanAccess";
import { joinByCode, type JoinResult } from "../../application/JoinByCode";
import { resolveAccessCode, type ResolvedCode } from "../../application/ResolveAccessCode";
import { touchScannerSync, setSessionZone } from "../../application/ScannerSessions";
import { listZones } from "@/server/events/application/ManageZones";
import type { Zone } from "@/server/events/domain/Zone";
import type { ScanResult } from "../../domain/ScanResult";

const schema = z.object({
  qrCode:    z.string().min(4),
  // eventSlug requerido para verificar que el escáner tiene permiso.
  // Sin él se rechaza — evita que cualquier usuario auth escanee cualquier evento.
  eventSlug: z.string().min(1),
});

const joinSchema = z.object({
  code:     z.string().min(1),
  deviceId: z.string().min(1),
  fullName: z.string().nullish(),
  dni:      z.string().nullish(),
});

const admitSchema = z.object({
  ticketId:  z.string().min(1),
  eventSlug: z.string().min(1),
});

// offlineScannedAt lo reporta el dispositivo del portero sin firmar: acotarlo
// evita que un cliente falsee used_at (auditoría/dup_offline) mandando una
// fecha arbitraria pasada o futura. Ventanas generosas porque un portero
// puede quedarse offline varios días antes de sincronizar.
const OFFLINE_SCAN_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 min de tolerancia de reloj
const OFFLINE_SCAN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

// Si offlineScannedAt es inválido, futuro, o demasiado antiguo, se descarta
// (undefined) y el repositorio cae a su default: now() del servidor.
function resolveOfflineScannedAt(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  const now = Date.now();
  if (parsed.getTime() > now + OFFLINE_SCAN_MAX_FUTURE_SKEW_MS) return undefined;
  if (parsed.getTime() < now - OFFLINE_SCAN_MAX_AGE_MS) return undefined;
  return parsed;
}

export const ScanningController = {
  async scan(
    input: unknown,
    context?: { offlineScannedAt?: string; deviceId?: string },
  ): Promise<Result<ScanResult>> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return err("invalid_input");

    const access = await verifyScanAccess(parsed.data.eventSlug, {
      deviceId: context?.deviceId,
    });
    if (!access.ok) return err(access.error);

    // Registra actividad de la puerta (alimenta el banner "sin sincronizar").
    if (access.value.via === "session" && access.value.sessionId) {
      void touchScannerSync(access.value.sessionId);
    }

    return scanQr(
      { ticketRepo: supabaseTicketRepository },
      {
        qrCode:    parsed.data.qrCode,
        scanner:   { profileId: access.value.profileId, sessionId: access.value.sessionId },
        usedAt:    resolveOfflineScannedAt(context?.offlineScannedAt),
        // Validación de puerta solo en el scan en vivo: en el sync offline la
        // decisión ya se tomó en la puerta (y el ticket pudo marcarse local).
        zoneId:    context?.offlineScannedAt ? undefined : access.value.zoneId,
        // El ticket debe pertenecer al evento de esta sesión (anti cross-event).
        expectedEventId: access.value.eventId,
      },
    );
  },

  // Admisión confiable por ticketId (alta manual desde la lista o sync offline).
  async admit(
    input: unknown,
    context?: { offlineScannedAt?: string; deviceId?: string },
  ): Promise<Result<ScanResult>> {
    const parsed = admitSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");

    const access = await verifyScanAccess(parsed.data.eventSlug, {
      deviceId: context?.deviceId,
    });
    if (!access.ok) return err(access.error);
    if (access.value.via === "session" && access.value.sessionId) {
      void touchScannerSync(access.value.sessionId);
    }

    return admitTicket(
      { ticketRepo: supabaseTicketRepository },
      {
        ticketId:  parsed.data.ticketId,
        scanner:   { profileId: access.value.profileId, sessionId: access.value.sessionId },
        usedAt:    resolveOfflineScannedAt(context?.offlineScannedAt),
        // El ticket debe pertenecer al evento de esta sesión (anti cross-event).
        expectedEventId: access.value.eventId,
      },
    );
  },

  // Valida el código por detrás (paso 1 del onboarding) y devuelve el evento, sin
  // crear sesión. Así el portero confirma el código antes de identificarse.
  async resolveCode(code: unknown): Promise<Result<ResolvedCode>> {
    if (typeof code !== "string") return err("invalid_input");
    return resolveAccessCode(code);
  },

  // Onboarding del portero: canjea código → sesión con binding 24h.
  async join(input: unknown): Promise<Result<JoinResult>> {
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return joinByCode({
      code: parsed.data.code,
      deviceId: parsed.data.deviceId,
      fullName: parsed.data.fullName ?? null,
      dni: parsed.data.dni ?? null,
    });
  },

  // Estado de acceso para el gate del cliente: ¿puede escanear este evento?
  async sessionStatus(
    eventSlug: string,
    deviceId?: string,
  ): Promise<Result<{ active: boolean; via: ScanAccessContext["via"] | null; zoneId: string | null }>> {
    const access = await verifyScanAccess(eventSlug, { deviceId });
    if (!access.ok) {
      // Distinguir "no logueado" para que el gate muestre login vs código.
      if (access.error === "unauthorized") return err("unauthorized");
      return ok({ active: false, via: null, zoneId: null });
    }
    return ok({
      active: true,
      via: access.value.via,
      zoneId: access.value.zoneId,
    });
  },

  // Puertas del evento para que el portero elija la suya (acceso por sesión, no
  // requiere ser miembro de la org).
  async listDoors(
    eventSlug: string,
    deviceId?: string,
  ): Promise<Result<Zone[]>> {
    const access = await verifyScanAccess(eventSlug, { deviceId });
    if (!access.ok) return err(access.error);
    return ok(await listZones(access.value.eventId));
  },

  // El portero cambia su puerta activa. zoneId null = puerta principal (valida
  // todas). Solo aplica a sesiones de portero; el organizador (membership) valida
  // todo siempre.
  async setZone(
    eventSlug: string,
    zoneId: string | null,
    deviceId?: string,
  ): Promise<Result<{ zoneId: string | null }>> {
    const access = await verifyScanAccess(eventSlug, { deviceId });
    if (!access.ok) return err(access.error);
    if (access.value.via !== "session" || !access.value.sessionId) {
      return err("not_a_door_session");
    }
    const okSet = await setSessionZone(
      access.value.sessionId,
      access.value.eventId,
      zoneId,
    );
    if (!okSet) return err("invalid_zone");
    return ok({ zoneId });
  },
};
