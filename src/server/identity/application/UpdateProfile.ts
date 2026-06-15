import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import { err, ok, type Result } from "@/server/_shared/result";
import type { OrganizerType, User } from "../domain/User";

type Input = {
  profileId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  dni: string | null;
  organizerType?: OrganizerType | null;
};

export const updateProfile = async (input: Input): Promise<Result<User>> => {
  const db = supabaseAdmin();

  const patch: Record<string, string | null> = {};
  if (input.fullName !== null) patch.full_name = input.fullName;
  if (input.email !== null) patch.email = input.email;
  if (input.phone !== null) patch.phone = input.phone;
  if (input.organizerType !== undefined) patch.organizer_type = input.organizerType;

  const { data: profile, error: pErr } = await db
    .from("profiles")
    .update(patch)
    .eq("id", input.profileId)
    .select("*")
    .single();
  if (pErr || !profile) return err(pErr?.message ?? "profile_update_failed");

  if (input.dni && input.dni.length >= 6) {
    const last2 = input.dni.slice(-2);
    const { error: kycErr } = await db.from("kyc_documents").upsert(
      {
        profile_id: input.profileId,
        doc_kind: "dni",
        doc_number: input.dni,
        last2,
      },
      { onConflict: "profile_id,doc_kind" },
    );
    if (kycErr) return err(kycErr.message);
  }

  return ok({
    id: profile.id,
    email: profile.email,
    phone: profile.phone,
    fullName: profile.full_name,
    dni: input.dni ?? null,
    avatarUrl: profile.avatar_url,
    initialRole: profile.initial_role,
    organizerType: profile.organizer_type ?? null,
    createdAt: profile.created_at,
  });
};
