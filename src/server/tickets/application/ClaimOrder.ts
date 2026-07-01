import type { Result } from "@/server/_shared/result";
import type { TicketRepository } from "../ports/TicketRepository";

type Deps = { repo: TicketRepository };

type Input = {
  orderId: string;
  toProfile: string;
};

// Reclama la PROPIA compra al loguearse tras pagar como invitado: engancha las
// entradas de la orden a la cuenta. La posesión del token de la orden (validado
// en el controller) + la sesión definen quién la recibe.
export const claimOrder = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<{ ticketsClaimed: number; eventSlug: string; firstTicketId: string | null }>> => {
  return repo.claimOrder(input);
};
