import type { Result } from "@/server/_shared/result";
import type { PendingApproval, TicketRepository } from "../ports/TicketRepository";

type Deps = { repo: TicketRepository };

export const listPendingApprovals = (
  { repo }: Deps,
  eventId: string,
): Promise<Result<PendingApproval[]>> => repo.listPendingApprovals(eventId);

export const approveRegistration = (
  { repo }: Deps,
  orderId: string,
  eventId: string,
): Promise<Result<{ orderId: string }>> => repo.approveRegistration(orderId, eventId);

export const rejectRegistration = (
  { repo }: Deps,
  orderId: string,
  eventId: string,
): Promise<Result<{ orderId: string }>> => repo.rejectRegistration(orderId, eventId);
