import type { Result } from "@/server/_shared/result";
import type { Box } from "../domain/Box";

export type BoxRepository = {
  createForTicket(input: {
    ticketId: string;
    ownerId: string;
    capacity: number;
  }): Promise<Result<Box>>;
  getByToken(token: string): Promise<Box | null>;
  getByTicketId(ticketId: string, ownerId: string): Promise<Box | null>;
  join(input: {
    token: string;
    profileId: string;
    holderName: string;
    holderDni: string | null;
    holderPhone: string | null;
  }): Promise<Result<Box>>;
};
