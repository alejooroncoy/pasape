import type { NextRequest } from "next/server";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { fail, ok, json } from "@/server/_shared/http";
import { OrganizationsController } from "@/server/identity/organizations/controllers/rest/OrganizationsController";

export const GET = async (
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const org = await supabaseOrganizationRepository.findBySlug(slug);
  if (!org) return fail("not_found", 404);
  return ok(org);
};

export const PATCH = async (
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const body = await req.json().catch(() => ({}));
  return json(await OrganizationsController.update(slug, body));
};
