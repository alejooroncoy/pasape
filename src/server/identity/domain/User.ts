export type Role = "buyer" | "promoter" | "organizer";

export type OrganizerType = "production_company" | "venue_owner" | "independent_host";

export type User = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string | null;
  /** DNI guardado en kyc_documents — autorrellena el checkout. */
  dni: string | null;
  avatarUrl: string | null;
  initialRole: Role;
  organizerType: OrganizerType | null;
  createdAt: string;
};
