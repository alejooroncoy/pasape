import type { Result } from "@/server/_shared/result";
import { err } from "@/server/_shared/result";
import type { TicketRepository } from "../ports/TicketRepository";
import type { Ticket } from "../domain/Ticket";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

type Deps = { repo: TicketRepository };

type Input = {
  ticketId: string;
  fromProfile: string;
  toIdentifier: string; // phone or email
};

export const transferTicket = async (
  { repo }: Deps,
  input: Input,
): Promise<Result<Ticket>> => {
  const db = supabaseAdmin();
  const isEmail = input.toIdentifier.includes("@");
  const { data: target } = await db
    .from("profiles")
    .select("id")
    .eq(isEmail ? "email" : "phone", input.toIdentifier)
    .maybeSingle<{ id: string }>();
  if (!target) return err("recipient_not_registered");
  if (target.id === input.fromProfile) return err("cannot_self_transfer");
  return repo.transfer({
    ticketId: input.ticketId,
    fromProfile: input.fromProfile,
    toProfile: target.id,
    toContact: input.toIdentifier,
  });
};
