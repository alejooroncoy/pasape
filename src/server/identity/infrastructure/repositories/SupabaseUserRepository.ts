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

const toDomain = (r: Row): User => ({
  id: r.id,
  email: r.email,
  phone: r.phone,
  fullName: r.full_name,
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
    if (error) return null;
    return data ? toDomain(data) : null;
  },
};
