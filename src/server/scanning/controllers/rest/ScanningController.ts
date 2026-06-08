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
import { touchScannerSync } from "../../application/ScannerSessions";
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
  dniLast2: z.string().nullish(),
});

const admitSchema = z.object({
  ticketId:  z.string().min(1),
  eventSlug: z.string().min(1),
});

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
        scannerId: access.value.profileId,
        usedAt:    context?.offlineScannedAt ? new Date(context.offlineScannedAt) : undefined,
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
        scannerId: access.value.profileId,
        usedAt:    context?.offlineScannedAt ? new Date(context.offlineScannedAt) : undefined,
      },
    );
  },

  // Onboarding del portero: canjea código → sesión con binding 24h.
  async join(input: unknown): Promise<Result<JoinResult>> {
    const parsed = joinSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return joinByCode({
      code: parsed.data.code,
      deviceId: parsed.data.deviceId,
      fullName: parsed.data.fullName ?? null,
      dniLast2: parsed.data.dniLast2 ?? null,
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
};
