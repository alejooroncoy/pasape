import type { Result } from "@/server/_shared/result";
import type { PromoterClaimContext } from "../domain/PromoterClaim";

export type ClaimTokenInfo = {
  token: string;
  expiresAt: string;
};

export interface PromoterClaimRepository {
  /**
   * Devuelve el claim_token actual si todavía es válido; si no, lo refresca
   * con un nuevo random + 14 días de TTL. Idempotente para reenvíos.
   */
  getOrRefreshToken(
    orgPromoterId: string,
    organizationId: string,
  ): Promise<Result<ClaimTokenInfo>>;

  /**
   * Resuelve un token a su contexto sin consumirlo (para mostrar landing).
   * Falla si el token no existe, expiró o ya fue usado.
   */
  resolveToken(token: string): Promise<Result<PromoterClaimContext>>;

  /**
   * Marca el token como consumido y asocia el profile_id al org_promoter.
   * Idempotente: si ya está reclamado por el mismo profile, no falla.
   */
  consumeToken(
    token: string,
    profileId: string,
  ): Promise<Result<PromoterClaimContext>>;
}
