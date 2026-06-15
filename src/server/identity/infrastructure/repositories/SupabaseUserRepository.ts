import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { UserRepository } from "@/server/identity/ports/UserRepository";
import type { OrganizerType, Role, User } from "@/server/identity/domain/User";

type Row = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  initial_role: Role;
  organizer_type: OrganizerType | null;
  created_at: string;
};

const toDomain = (r: Row, dni: string | null): User => ({
  id: r.id,
  email: r.email,
  phone: r.phone,
  fullName: r.full_name,
  dni,
  avatarUrl: r.avatar_url,
  initialRole: r.initial_role,
  organizerType: r.organizer_type,
  createdAt: r.created_at,
});

export const supabaseUserRepository: UserRepository = {
  async findById(id) {
    const db = supabaseAdmin();
    const { data, error } = await db
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle<Row>();
    if (error || !data) return null;
    // DNI vive en kyc_documents (no en profiles) — lo exponemos para que el
    // checkout autorrellene los datos del comprador en compras siguientes.
    const { data: kyc } = await db
      .from("kyc_documents")
      .select("doc_number")
      .eq("profile_id", id)
      .eq("doc_kind", "dni")
      .maybeSingle<{ doc_number: string }>();
    return toDomain(data, kyc?.doc_number ?? null);
  },
};
