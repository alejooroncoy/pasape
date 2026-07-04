// Normaliza un teléfono a E.164 SIN "+" — el formato que exige la Cloud API de
// Meta (y por ende el proxy de Kapso).
//
// Fix de bug latente: números peruanos guardados en local (9 dígitos, "9XXXXXXXX")
// sin código de país eran rechazados por Meta. Si detectamos ese patrón, le
// anteponemos "51". Si el número ya trae código de país, se respeta tal cual.
export const formatWhatsAppPhone = (raw: string): string => {
  let p = raw.trim();
  if (p.startsWith("whatsapp:")) p = p.slice("whatsapp:".length);
  if (p.startsWith("+")) p = p.slice(1);
  const digits = p.replace(/\D/g, "");
  // Celular peruano local (9 dígitos, empieza en 9) → anteponer código país 51.
  if (digits.length === 9 && digits.startsWith("9")) return `51${digits}`;
  return digits;
};
