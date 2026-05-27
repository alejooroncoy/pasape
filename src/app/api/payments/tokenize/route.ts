import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

// Why: MP rechaza /v1/card_tokens desde el browser para nuestra cuenta
// sandbox (issue conocido). Proxy server-side: card data llega por HTTPS
// same-origin a esta route, la enviamos a MP con public_key + access_token
// y devolvemos solo el token. Sin persistir card data nunca.
//
// PCI: SAQ-A-EP. Cumplimos: HTTPS en prod, no logging de card data, no
// almacenamos, no escribimos a disco. Card data solo en memoria durante
// el procesamiento de esta request.

const schema = z.object({
  card_number: z.string().regex(/^\d{13,19}$/),
  cardholder: z.object({
    name: z.string().min(2).max(60),
    identification: z.object({
      type: z.string().min(2).max(10),
      number: z.string().min(6).max(20),
    }),
  }),
  security_code: z.string().regex(/^\d{3,4}$/),
  expiration_month: z.string().regex(/^(0[1-9]|1[0-2])$/),
  expiration_year: z.string().regex(/^20\d{2}$/),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_card_data", detail: parsed.error.issues[0]?.message },
      { status: 400 },
    );
  }

  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY;
  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!publicKey || !accessToken) {
    return NextResponse.json({ error: "missing_mp_credentials" }, { status: 500 });
  }

  const mpRes = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${encodeURIComponent(publicKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(parsed.data),
    },
  );
  const mpBody = (await mpRes.json().catch(() => ({}))) as {
    id?: string;
    cause?: Array<{ code: string; description: string }>;
    message?: string;
    error?: string;
  };

  if (!mpRes.ok || !mpBody.id) {
    const code = mpBody.cause?.[0]?.code ?? mpBody.error ?? mpBody.message ?? "token_failed";
    return NextResponse.json({ error: code }, { status: mpRes.status === 200 ? 400 : mpRes.status });
  }

  return NextResponse.json({ data: { id: mpBody.id } });
}
