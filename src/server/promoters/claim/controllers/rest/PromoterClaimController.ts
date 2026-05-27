import { z } from "zod";
import type { Result } from "@/server/_shared/result";
import { err } from "@/server/_shared/result";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabasePromoterClaimRepository } from "../../infrastructure/SupabasePromoterClaimRepository";
import {
  sendPromoterInvite,
  type SendPromoterInviteOutput,
} from "../../application/SendPromoterInvite";
import {
  claimPromoter,
  type ClaimPromoterOutput,
} from "../../application/ClaimPromoter";
import type { PromoterClaimContext } from "../../domain/PromoterClaim";

const deps = { claims: supabasePromoterClaimRepository };

const claimSchema = z.object({
  token: z.string().min(16),
});

export const PromoterClaimController = {
  /**
   * Org admin dispara el envío del invite por WhatsApp. Idempotente:
   * reusa el token si todavía es válido, si no lo refresca.
   */
  async sendInvite(orgPromoterId: string): Promise<Result<SendPromoterInviteOutput>> {
    const auth = await getAuthContext();
    if (!auth.ok) return err(auth.error);
    return sendPromoterInvite(deps, {
      callerProfileId: auth.value.profileId,
      orgPromoterId,
    });
  },

  /**
   * Resuelve un token a su contexto (sin consumir) — para mostrar la landing
   * "Hola Mauro, IN te invita a vender ...". El cliente la llama al cargar
   * /p/[token].
   */
  async preview(token: string): Promise<Result<PromoterClaimContext>> {
    return supabasePromoterClaimRepository.resolveToken(token);
  },

  /**
   * Consume el token y emite tokenHash de magic-link para que el cliente
   * arme la sesión Supabase. POST público porque por definición el caller
   * todavía no tiene sesión.
   */
  async claim(input: unknown): Promise<Result<ClaimPromoterOutput>> {
    const parsed = claimSchema.safeParse(input);
    if (!parsed.success) return err("invalid_input");
    return claimPromoter(deps, parsed.data);
  },
};
