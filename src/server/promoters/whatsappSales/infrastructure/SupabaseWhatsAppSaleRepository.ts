import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { WhatsAppSaleRepository } from "../ports/WhatsAppSaleRepository";
import type { WhatsAppSale } from "../domain/WhatsAppSale";

type SaleRow = {
  id: string;
  promoter_id: string;
  promoter_phone: string;
  buyer_phone: string;
  buyer_name: string | null;
  description: string | null;
  amount_cents: number;
  currency: string;
  status: "pending_payment" | "paid" | "rejected";
  confirmation_code: string;
  created_at: string;
  paid_at: string | null;
};

const toDomain = (row: SaleRow): WhatsAppSale => ({
  id: row.id,
  promoterId: row.promoter_id,
  promoterPhone: row.promoter_phone,
  buyerPhone: row.buyer_phone,
  buyerName: row.buyer_name,
  description: row.description,
  amountCents: row.amount_cents,
  currency: row.currency,
  status: row.status,
  confirmationCode: row.confirmation_code,
  createdAt: row.created_at,
  paidAt: row.paid_at,
});

export const supabaseWhatsAppSaleRepository: WhatsAppSaleRepository = {
  async create(input): Promise<Result<WhatsAppSale>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("whatsapp_sales")
      .insert({
        promoter_id: input.promoterId,
        promoter_phone: input.promoterPhone,
        buyer_phone: input.buyerPhone,
        buyer_name: input.buyerName ?? null,
        description: input.description ?? null,
        amount_cents: input.amountCents,
        currency: input.currency ?? "PEN",
        confirmation_code: input.confirmationCode,
      })
      .select("*")
      .single<SaleRow>();
    if (error || !data) return err(error?.message ?? "create_failed");
    return ok(toDomain(data));
  },

  async findPendingByPromoterAndBuyer(promoterId, buyerPhone): Promise<Result<WhatsAppSale | null>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("whatsapp_sales")
      .select("*")
      .eq("promoter_id", promoterId)
      .eq("buyer_phone", buyerPhone)
      .eq("status", "pending_payment")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<SaleRow>();
    if (error) return err(error.message);
    return ok(data ? toDomain(data) : null);
  },

  async findByConfirmationCode(code): Promise<Result<WhatsAppSale | null>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("whatsapp_sales")
      .select("*")
      .eq("confirmation_code", code.toUpperCase())
      .maybeSingle<SaleRow>();
    if (error) return err(error.message);
    return ok(data ? toDomain(data) : null);
  },

  async findPromoterIdByPhone(phone): Promise<Result<string | null>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("org_promoters")
      .select("id")
      .eq("whatsapp", phone)
      .is("deleted_at", null)
      .maybeSingle<{ id: string }>();
    if (error) return err(error.message);
    return ok(data?.id ?? null);
  },

  async confirmPayment(saleId, promoterId): Promise<Result<WhatsAppSale | null>> {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("confirm_whatsapp_sale", {
      p_sale_id: saleId,
      p_promoter_id: promoterId,
    });
    if (error) return err(error.message);
    const result = data as { ok: boolean; sale?: SaleRow };
    if (!result.ok || !result.sale) return ok(null);
    return ok(toDomain(result.sale));
  },

  async rejectPayment(saleId, promoterId): Promise<Result<WhatsAppSale | null>> {
    const db = supabaseAdmin();
    const { data, error } = await db.rpc("reject_whatsapp_sale", {
      p_sale_id: saleId,
      p_promoter_id: promoterId,
    });
    if (error) return err(error.message);
    const result = data as { ok: boolean; sale?: SaleRow };
    if (!result.ok || !result.sale) return ok(null);
    return ok(toDomain(result.sale));
  },

  async listByPromoter(promoterId): Promise<Result<WhatsAppSale[]>> {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("whatsapp_sales")
      .select("*")
      .eq("promoter_id", promoterId)
      .order("created_at", { ascending: false });
    if (error) return err(error.message);
    return ok((data as SaleRow[]).map(toDomain));
  },
};
