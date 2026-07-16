import type { Result } from "@/server/_shared/result";
import { err } from "@/server/_shared/result";
import type { Event } from "../domain/Event";
import type { CreateEventInput, EventRepository } from "../ports/EventRepository";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { MIN_PAID_TICKET_PRICE_CENTS } from "@/lib/tickets/serviceFee";

type Deps = { repo: EventRepository };

type TicketTypeInput = {
  name: string;
  kind: "general" | "box";
  priceCents: number;
  /** `null` = sin límite. Solo válido para kind="general" — un box siempre es finito. */
  capacity: number | null;
  /** Etiqueta del box (A, B, VIP-1). Requerido cuando kind === "box". */
  boxLabel?: string | null;
  /** Cómo llamar a la unidad reservable (box, mesa, lounge...). Opcional. */
  unitNoun?: string | null;
  /** Cierre de venta del tipo (no de la preventa). Opcional. */
  saleEndsAt?: string | null;
  /** PREVENTA: precio bajo al arrancar. null = sin preventa. */
  presalePriceCents?: number | null;
  presaleQty?: number | null;
  presaleEndsAt?: string | null;
  /** Liberar gratis: toggle + fin opcional (null = mientras esté activa). */
  isFree?: boolean;
  freeUntilAt?: string | null;
};

export const createEvent = async (
  { repo }: Deps,
  input: CreateEventInput & { ticketTypes: TicketTypeInput[] },
): Promise<Result<Event>> => {
  if (!input.title.trim()) return err("title_required");
  if (input.ticketTypes.length === 0) return err("ticket_types_required");
  // Why: el label del box es lo que ve el portero al validar el QR ("BOX A").
  // Sin label no podemos diferenciar box 10 vs box 11 — se exige al crear.
  for (const tt of input.ticketTypes) {
    if (tt.kind === "box" && !tt.boxLabel?.trim()) return err("box_label_required");
    if (tt.kind === "box" && tt.capacity == null) return err("box_capacity_required");
    // Piso absoluto S/3 (el fee nunca puede superar el precio). Entre S/3 y
    // S/15 el fee se cobra igual pero se oculta como línea aparte (ver
    // resolveOrderFee) — no depende de fee_mode, por eso el mínimo es fijo.
    if (tt.priceCents > 0 && tt.priceCents < MIN_PAID_TICKET_PRICE_CENTS) {
      return err("price_below_minimum");
    }
  }

  const created = await repo.create(input);
  if (!created.ok) return created;

  const db = supabaseAdmin();
  const { error } = await db.from("ticket_types").insert(
    input.ticketTypes.map((tt, i) => ({
      event_id: created.value.id,
      name: tt.name,
      kind: tt.kind,
      price_cents: tt.priceCents,
      capacity: tt.capacity,
      position: i,
      box_label: tt.kind === "box" ? tt.boxLabel?.trim() ?? null : null,
      unit_noun:
        tt.kind === "box" && tt.unitNoun?.trim() ? tt.unitNoun.trim() : null,
      sale_ends_at: tt.saleEndsAt ?? null,
      presale_price_cents: tt.presalePriceCents ?? null,
      presale_qty: tt.presaleQty ?? null,
      presale_ends_at: tt.presaleEndsAt ?? null,
      is_free: tt.isFree ?? false,
      free_until_at: tt.freeUntilAt ?? null,
    })),
  );
  if (error) return err(error.message);

  return created;
};
