import { z } from "zod";
import { err, type Result } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseTicketRepository } from "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository";
import { scanQr } from "../../application/ScanQr";
import type { ScanResult } from "../../domain/ScanResult";

const schema = z.object({ qrCode: z.string().min(4) });

export const ScanningController = {
  async scan(
    input: unknown,
    context?: { offlineScannedAt?: string },
  ): Promise<Result<ScanResult>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    const parsed = schema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return scanQr(
      { ticketRepo: supabaseTicketRepository },
      {
        qrCode: parsed.data.qrCode,
        scannerId: auth.value.profileId,
        usedAt: context?.offlineScannedAt ? new Date(context.offlineScannedAt) : undefined,
      },
    );
  },
};
