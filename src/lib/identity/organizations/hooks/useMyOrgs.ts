"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { OrgRole } from "@/server/identity/organizations/domain/Organization";

export type OrgWithRole = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  description: string | null;
  instagram: string | null;
  legalEntityId: string;
  role: OrgRole;
};

export const myOrgsKey = ["identity", "orgs", "mine"] as const;

export const useMyOrgs = () =>
  useQuery({
    queryKey: myOrgsKey,
    queryFn: () => api.get<OrgWithRole[]>("/api/organizations"),
  });
