import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const hasSecret = !!process.env.TICKET_LINK_SECRET;
const hasSupabase =
  !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;

describe("audit v2 remediation — smoke (unitario)", () => {
  it("validateMpPaymentAmount acepta montos que coinciden", async () => {
    const { validateMpPaymentAmount } = await import(
      "@/server/payments/application/validateMpPaymentAmount"
    );
    const res = validateMpPaymentAmount(400, 4, randomUUID());
    expect(res.ok).toBe(true);
  });

  it("validateMpPaymentAmount rechaza drift de monto", async () => {
    const { validateMpPaymentAmount } = await import(
      "@/server/payments/application/validateMpPaymentAmount"
    );
    const res = validateMpPaymentAmount(400, 3.5, randomUUID());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("payment_amount_mismatch");
  });

  it.skipIf(!hasSecret)("verifyOrderLink valida token firmado de orden", async () => {
    const { signOrderLink, verifyOrderLink } = await import(
      "@/server/notifications/domain/OrderLinkToken"
    );
    const orderId = randomUUID();
    const token = signOrderLink(orderId);
    expect(verifyOrderLink(orderId, token)).toBe(true);
    expect(verifyOrderLink(orderId, "0".repeat(token.length))).toBe(false);
    expect(verifyOrderLink(randomUUID(), token)).toBe(false);
  });

  it.skipIf(!hasSecret)(
    "assertOrderPaymentAccess permite portador de orderToken sin sesión",
    async () => {
      vi.resetModules();
      vi.doMock("@/server/_shared/AuthContext", () => ({
        getAuthContext: vi.fn(async () => ({ ok: false, error: "unauthenticated" })),
      }));
      const { signOrderLink } = await import("@/server/notifications/domain/OrderLinkToken");
      const { assertOrderPaymentAccess } = await import(
        "@/server/payments/application/assertOrderPaymentAccess"
      );
      const orderId = randomUUID();
      const token = signOrderLink(orderId);
      const res = await assertOrderPaymentAccess({
        orderId,
        buyerId: randomUUID(),
        guestEmail: null,
        orderToken: token,
      });
      expect(res.ok).toBe(true);
      vi.doUnmock("@/server/_shared/AuthContext");
    },
  );

  it("assertOrderPaymentAccess rechaza UUID ajeno sin token", async () => {
    vi.resetModules();
    vi.doMock("@/server/_shared/AuthContext", () => ({
      getAuthContext: vi.fn(async () => ({ ok: false, error: "unauthenticated" })),
    }));
    const { assertOrderPaymentAccess } = await import(
      "@/server/payments/application/assertOrderPaymentAccess"
    );
    const res = await assertOrderPaymentAccess({
      orderId: randomUUID(),
      buyerId: randomUUID(),
      guestEmail: "otro@example.com",
      orderToken: null,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("forbidden");
    vi.doUnmock("@/server/_shared/AuthContext");
  });
});

describe.skipIf(!hasSupabase)("audit v2 remediation — smoke (integración)", () => {
  it("priceOrder rechaza qty>1 en ticket tipo box", async () => {
    const { supabaseAdmin } = await import("@/server/_shared/supabase/admin");
    const db = supabaseAdmin();
    const { data: boxType } = await db
      .from("ticket_types")
      // Filtramos por evento "published": priceOrder corta con event_not_published
      // antes de llegar a validar qty, así que un box de un evento en draft/
      // pending_review/closed/cancelled (dev DB compartida y mutable) daría
      // ese error en vez del que este test realmente ejercita.
      .select("id, event_id, event:events!inner(status)")
      .eq("kind", "box")
      .eq("event.status", "published")
      .limit(1)
      .maybeSingle<{ id: string; event_id: string }>();
    if (!boxType) return;

    const { supabaseTicketRepository } = await import(
      "@/server/tickets/infrastructure/repositories/SupabaseTicketRepository"
    );
    const res = await supabaseTicketRepository.quote({
      eventId: boxType.event_id,
      items: [{ ticketTypeId: boxType.id, qty: 2 }],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("box_qty_must_be_one");
  });
});
