import { NextResponse, type NextRequest } from "next/server";
import { firebaseAuthProvider } from "@/server/identity/infrastructure/auth/FirebaseAuthProvider";
import { supabaseUserRepository } from "@/server/identity/infrastructure/repositories/SupabaseUserRepository";
import { SESSION_COOKIE } from "@/server/_shared/AuthContext";

const SESSION_MAX_AGE = 60 * 60; // 1 h — matches Firebase ID token lifetime

export const POST = async (req: NextRequest) => {
  const body = (await req.json().catch(() => null)) as { idToken?: string } | null;
  const idToken = body?.idToken;
  if (!idToken) {
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  const verified = await firebaseAuthProvider.verifyIdToken(idToken);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const upserted = await supabaseUserRepository.upsert({
    firebaseUid: verified.value.uid,
    email: verified.value.email,
    phone: verified.value.phone,
    fullName: verified.value.name,
    avatarUrl: verified.value.picture,
  });
  if (!upserted.ok) {
    return NextResponse.json({ error: upserted.error }, { status: 500 });
  }

  const res = NextResponse.json({ profile: upserted.value });
  res.cookies.set(SESSION_COOKIE, idToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
};

export const DELETE = async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
};
