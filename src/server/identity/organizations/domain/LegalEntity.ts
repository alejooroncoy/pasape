export type LegalEntity = {
  id: string;
  name: string;
  taxId: string | null;
  country: string;
  // Página pública (hub de marcas). Opcional — solo cuando el organizador quiera
  // tener una URL paraguas tipo `pasape.lat/p/inpuntahermosa`.
  slug: string | null;
  displayName: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  // Cuenta bancaria para payouts — Pasape cobra y al cierre del evento
  // transfiere lo recaudado a esta cuenta.
  bankName: string | null;
  bankAccountNumber: string | null;
  bankCci: string | null;
  createdBy: string;
  createdAt: string;
};
