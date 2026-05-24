import type { NextRequest } from "next/server";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { fail, ok } from "@/server/_shared/http";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const org = await supabaseOrganizationRepository.findBySlug(slug);
  if (!org) return fail("not_found", 404);
  return ok(org);
};
