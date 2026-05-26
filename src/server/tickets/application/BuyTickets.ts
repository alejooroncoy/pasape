import type { Result } from "@/server/_shared/result";
import type { BuyInput, BuyOutput, TicketRepository } from "../ports/TicketRepository";

type Deps = { repo: TicketRepository };

export const buyTickets = (
  { repo }: Deps,
  input: BuyInput,
): Promise<Result<BuyOutput>> => repo.buy(input);
