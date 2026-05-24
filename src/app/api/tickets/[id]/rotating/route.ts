import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { getAuthContext } from "@/server/_shared/AuthContext";
import {
  WINDOW_SECONDS,
  buildRotatingPayload,
  computeRotatingCode,
  currentWindow,
} from "@/server/tickets/domain/RotatingQr";

// Rate limit in-memory por (profile, ticket). 30 req/min basta para polling
// cada 8s con margen.
type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

const consumeRate = (key: string): boolean => {
  const now = Date.now();
  const b = BUCKETS.get(key);
  if (!b || now > b.resetAt) {
    BUCKETS.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (b.count >= MAX_PER_WINDOW) return false;
  b.count += 1;
  return true;
};

type TicketRow = {
  id: string;
  status: string;
  current_holder: string;
  rotation_secret: string;
};

export const GET = async (
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id: ticketId } = await ctx.params;

  // Capa 1: sesión válida.
  const auth = await getAuthContext();
  if (!auth.ok) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // Capa 2: rate limit por (profile, ticket).
  if (!consumeRate(`${auth.value.profileId}:${ticketId}`)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Capa 3: el ticket existe, está activo, y pertenece al usuario.
  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select("id, status, current_holder, rotation_secret")
    .eq("id", ticketId)
    .maybeSingle<TicketRow>();
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.current_holder !== auth.value.profileId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (ticket.status !== "active") {
    return NextResponse.json({ error: "ticket_inactive" }, { status: 410 });
  }

  const hex = ticket.rotation_secret.startsWith("\\x")
    ? ticket.rotation_secret.slice(2)
    : ticket.rotation_secret;
  const secret = Buffer.from(hex, "hex");

  const win = currentWindow();
  const code = computeRotatingCode(secret, ticketId, win);
  const payload = buildRotatingPayload({ ticketId, windowIdx: win, code });
  const expiresAt = (win + 1) * WINDOW_SECONDS * 1000;

  return NextResponse.json({
    data: { payload, windowIdx: win, expiresAt, ttlSeconds: WINDOW_SECONDS },
  });
};
