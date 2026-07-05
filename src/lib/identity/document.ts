// Documento de identidad del titular: DNI peruano o documento de extranjero.
// Fuente ÚNICA de la regla de validación, compartida por el frontend (forms) y
// el backend (zod schemas) para que no diverjan.
//
// - Peruano (isForeigner=false): DNI de EXACTAMENTE 8 dígitos → estricto, seguro.
// - Extranjero (isForeigner=true): pasaporte/C.E alfanumérico, 5-20 → laxo, no
//   bloquea (los formatos varían por país).

export const isValidDocument = (doc: string | null | undefined, isForeigner: boolean): boolean => {
  const d = (doc ?? "").trim();
  return isForeigner ? d.length >= 5 && d.length <= 20 : /^\d{8}$/.test(d);
};

/** Tipo deducido del formato, para display (reporte) y mapeo de pago. */
export const documentType = (doc: string | null | undefined): "DNI" | "C.E" | "Pasaporte" | null => {
  const d = (doc ?? "").trim();
  if (!d) return null;
  if (d.startsWith("··")) return "DNI"; // enmascarado de compras viejas
  if (/^\d{8}$/.test(d)) return "DNI";
  if (/^\d{9,12}$/.test(d)) return "C.E";
  return "Pasaporte";
};
