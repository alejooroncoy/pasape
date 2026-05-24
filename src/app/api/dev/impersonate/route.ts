import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { firebaseAuth } from "@/server/identity/infrastructure/FirebaseAdmin";
import { SESSION_COOKIE } from "@/server/_shared/AuthContext";

// DEV-ONLY: impersona un profile existente por email creando un Firebase
// custom token, intercambiándolo por un idToken vía REST API, y seteando la
// cookie de sesión. Bloqueado en producción.

export const GET = async (req: NextRequest) => {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_available" }, { status: 404 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email_required" }, { status: 400 });

  const db = supabaseAdmin();
  const { data: profile } = await db
    .from("profiles")
    .select("id, firebase_uid, email, full_name")
    .eq("email", email.toLowerCase())
    .maybeSingle<{ id: string; firebase_uid: string | null; email: string | null; full_name: string | null }>();
  if (!profile) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  if (!profile.firebase_uid) {
    return NextResponse.json({ error: "no_firebase_uid" }, { status: 400 });
  }

  // 1. Custom token vía firebase-admin.
  const customToken = await firebaseAuth().createCustomToken(profile.firebase_uid);

  // 2. Exchange por idToken usando la REST API pública de Firebase.
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing_firebase_api_key" }, { status: 500 });
  }
  const exchange = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!exchange.ok) {
    const errText = await exchange.text().catch(() => "");
    return NextResponse.json(
      { error: "exchange_failed", detail: errText.slice(0, 200) },
      { status: 502 },
    );
  }
  const { idToken } = (await exchange.json()) as { idToken: string };

  // 3. Setear cookie y redirect a home.
  const redirect = url.searchParams.get("next") ?? "/es";
  const res = NextResponse.redirect(new URL(redirect, req.url));
  res.cookies.set(SESSION_COOKIE, idToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 60 * 60, // 1h, igual que un idToken normal
  });
  return res;
};
