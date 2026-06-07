import { z } from "zod";
import { err, ok, type Result } from "@/server/_shared/result";
import { supabaseTicketRepository } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
import { scanQr } from "../../application/ScanQr";
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
