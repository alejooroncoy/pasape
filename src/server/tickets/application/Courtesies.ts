import type { Result } from "@/server/_shared/result";
import type {
  BuyOutput,
  CourtesyInput,
  CourtesySummary,
  TicketRepository,
} from "../ports/TicketRepository";

type Deps = { repo: TicketRepository };

export const issueCourtesy = (
  { repo }: Deps,
  input: CourtesyInput,
): Promise<Result<BuyOutput>> => repo.issueCourtesy(input);

export const listCourtesies = (
  { repo }: Deps,
  eventId: string,
): Promise<Result<CourtesySummary[]>> => repo.listCourtesies(eventId);
