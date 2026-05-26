import { headers } from "next/headers";
import { z } from "zod";
import { fail, ok, unauthorized } from "@/server/_shared/http";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { supabaseBoxRepository } from "@/server/boxes/infrastructure/repositories/SupabaseBoxRepository";
import { createBoxForTicket } from "@/server/boxes/application/BoxServices";

const ctxSchema = z.object({ id: z.string().uuid() });

// POST /api/tickets/[id]/invite-box
// Genera (o reutiliza) el link de invitación al box del ticket dado.
// Solo el holder actual del ticket puede invitar (= el "host" del box).
// Response: { url, remainingSlots }
export const POST = async (
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  const auth = await getAuthContext();
  if (!auth.ok) return unauthorized();
  const parsed = ctxSchema.safeParse(await params);
  if (!parsed.success) return fail("invalid_input");
  const ticketId = parsed.data.id;

  const db = supabaseAdmin();
  // Why: necesitamos `capacity` del ticket_type para saber cuántos amigos
  // caben en el box. Si el ticket no tiene box_label, no se puede invitar.
  const { data: ticket } = await db
    .from("tickets")
    .select(
      "id, current_holder, box_label, box_host_ticket_id, ticket_type:ticket_types!inner(id, capacity)",
    )
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) return fail("ticket_not_found", 404);

  type T = {
    id: string;
    current_holder: string;
    box_label: string | null;
    box_host_ticket_id: string | null;
    ticket_type: { id: string; capacity: number };
  };
  const t = ticket as unknown as T;
  if (t.current_holder !== auth.value.profileId) return fail("not_owner", 403);
  if (!t.box_label) return fail("not_a_box_ticket");
  if (t.box_host_ticket_id) return fail("only_host_can_invite");

  const result = await createBoxForTicket(
    { repo: supabaseBoxRepository },
    { ticketId, ownerId: auth.value.profileId, capacity: t.ticket_type.capacity },
  );
  if (!result.ok) return fail(result.error);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "pasape.lat";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const url = `${proto}://${host}/box/${result.value.inviteToken}`;
  const remainingSlots = Math.max(0, result.value.capacity - result.value.members.length);
  return ok({ url, remainingSlots });
};
