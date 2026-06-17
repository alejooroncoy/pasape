import type { Result } from "@/server/_shared/result";
import type { TicketRepository } from "../ports/TicketRepository";
import type { Ticket } from "../domain/Ticket";

type Deps = { repo: TicketRepository };

type Input = {
  token: string;
  toProfile: string;
};

// Reclama una transferencia pendiente. La posesión del token (que llegó por
// WhatsApp al número del receptor) es la credencial: quien abre el link y está
// logueado se queda con la entrada.
export const claimTransfer = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<{ ticket: Ticket; eventSlug: string }>> => {
  return repo.claimTransfer(input);
};
