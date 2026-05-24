import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";

const schema = z.object({
  email: z.string().email(),
  source: z.string().max(64).optional(),
});

// Rate limit in-memory: 5 req/min por IP. Suficiente para mitigar abuso casual.
type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();

const consumeRate = (ip: string): boolean => {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || now > b.resetAt) {
    BUCKETS.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (b.count >= 5) return false;
  b.count += 1;
  return true;
};

const ipOf = (req: NextRequest): string =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  req.headers.get("x-real-ip") ??
  "unknown";

export const POST = async (req: NextRequest) => {
  if (!consumeRate(ipOf(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const db = supabaseAdmin();
  const { error } = await db
    .from("newsletter_signups")
    .upsert(
      { email: parsed.data.email.toLowerCase(), source: parsed.data.source ?? "home" },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (error) {
    console.error("[newsletter] failed:", error.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ data: { ok: true } });
};
