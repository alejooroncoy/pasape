import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { verifyTicketLink } from "@/server/notifications/domain/TicketLinkToken";
import {
  WINDOW_SECONDS,
  buildRotatingPayload,
  computeRotatingCode,
  currentWindow,
} from "@/server/tickets/domain/RotatingQr";

// Rate limit in-memory por IP + ticket. En prod sustituir por edge/redis.
type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30; // 30 req/min — suficiente para polling cada 8s con margen

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

const ipOf = (req: NextRequest): string => {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
};

type TicketRow = { id: string; status: string; rotation_secret: string };

export const GET = async (
  req: NextRequest,
  ctx: { params: Promise<{ ticketId: string }> },
) => {
  const { ticketId } = await ctx.params;
  const url = new URL(req.url);
  const k = url.searchParams.get("k");

  // Capa 1: firma del link. Sin signature válida no pasa.
  if (!k || !verifyTicketLink(ticketId, k)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Capa 2: rate limit por (ip, ticket).
  const rateKey = `${ipOf(req)}:${ticketId}`;
  if (!consumeRate(rateKey)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // Capa 3: ticket existe y está activo.
  const db = supabaseAdmin();
  const { data: ticket } = await db
    .from("tickets")
    .select("id, status, rotation_secret")
    .eq("id", ticketId)
    .maybeSingle<TicketRow>();
  if (!ticket) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (ticket.status !== "active") {
    return NextResponse.json({ error: "ticket_inactive" }, { status: 410 });
  }

  // Supabase devuelve bytea como hex string con prefijo "\\x". Lo decodificamos.
  const hex = ticket.rotation_secret.startsWith("\\x")
    ? ticket.rotation_secret.slice(2)
    : ticket.rotation_secret;
  const secret = Buffer.from(hex, "hex");

  const win = currentWindow();
  const code = computeRotatingCode(secret, ticketId, win);
  const payload = buildRotatingPayload({ ticketId, windowIdx: win, code });

  // Cuándo expira el window actual (en epoch ms).
  const expiresAt = (win + 1) * WINDOW_SECONDS * 1000;

  return NextResponse.json({
    data: {
      payload,
      windowIdx: win,
      expiresAt,
      ttlSeconds: WINDOW_SECONDS,
    },
  });
};
