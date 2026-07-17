import type { Result } from "@/server/_shared/result";
import type { TicketRepository } from "../ports/TicketRepository";
import type { Ticket } from "../domain/Ticket";

type Deps = { repo: TicketRepository };

type Input = {
  token: string;
  toProfile: string;
  fullName?: string | null;
  dni?: string | null;
  customFieldAnswers?: Record<string, unknown>;
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

// Preview de solo-lectura para la página de canje: qué preguntas debe
// responder quien está a punto de reclamar (customFieldAnswers son por
// entrada, no por orden — cada persona real las responde por su cuenta).
export const previewClaimTransfer = async ({ repo }: Deps, token: string) => {
  return repo.previewClaim(token);
};
