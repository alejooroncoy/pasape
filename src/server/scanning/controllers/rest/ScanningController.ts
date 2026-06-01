import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { supabaseTicketRepository } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
import { scanQr } from "../../application/ScanQr";
import { verifyScanAccess } from "../../application/VerifyScanAccess";
import type { ScanResult } from "../../domain/ScanResult";

const schema = z.object({
  qrCode:    z.string().min(4),
  // eventSlug requerido para verificar que el escáner tiene permiso.
  // Sin él se rechaza — evita que cualquier usuario auth escanee cualquier evento.
  eventSlug: z.string().min(1),
});

export const ScanningController = {
  async scan(
    input: unknown,
    context?: { offlineScannedAt?: string },
  ): Promise<Result<ScanResult>> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return err("invalid_input");

    const access = await verifyScanAccess(parsed.data.eventSlug);
    if (!access.ok) return err(access.error);

    return scanQr(
      { ticketRepo: supabaseTicketRepository },
      {
        qrCode:    parsed.data.qrCode,
        scannerId: access.value.profileId,
        usedAt:    context?.offlineScannedAt ? new Date(context.offlineScannedAt) : undefined,
      },
    );
  },
};
