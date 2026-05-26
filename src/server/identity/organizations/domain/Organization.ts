export type OrgRole = "owner" | "admin" | "editor" | "reporter" | "door";

export type Organization = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  legalEntityId: string;
  timezone: string;
  createdBy: string;
  createdAt: string;
};

export type OrgMembership = {
  organizationId: string;
  profileId: string;
  role: OrgRole;
};
