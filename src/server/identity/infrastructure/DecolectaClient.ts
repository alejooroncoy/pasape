import { err, ok, type Result } from "@/server/_shared/result";

/**
 * Cliente para Decolecta (https://api.decolecta.com.pe) — RENIEC DNI lookup.
 *
 * NO bloquea el checkout: si falla, el caller debe permitir que el usuario
 * tipee a mano. Solo se usa para autocompletar el campo nombre.
 */

export type DniData = {
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
};

export type DniLookupError =
  | "decolecta_not_configured"
  | "dni_not_found"
  | "lookup_failed";

const ENDPOINT = "https://api.decolecta.com/v1/reniec/dni";

type DecolectaResponse = {
  first_name?: string;
  first_last_name?: string;
  second_last_name?: string;
  full_name?: string;
  document_number?: string;
};

export const lookupDni = async (
  dni: string,
): Promise<Result<DniData, DniLookupError>> => {
  // Why: aceptamos ambos nombres (DECOLECTA_API_KEY canónico + RENIEC_API_TOKEN
  // como alias) para no forzar a renombrar vars ya configuradas en prod.
  const apiKey = process.env.DECOLECTA_API_KEY ?? process.env.RENIEC_API_TOKEN;
  if (!apiKey) return err("decolecta_not_configured");

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?numero=${encodeURIComponent(dni)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Referer: "pasape.app",
      },
      // No-cache: respuesta es por DNI, querramos siempre la más fresca
      cache: "no-store",
      // Timeout corto: no queremos bloquear UX si Decolecta tarda
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return err("lookup_failed");
  }

  if (res.status === 404) return err("dni_not_found");
  if (!res.ok) return err("lookup_failed");

  let body: DecolectaResponse;
  try {
    body = (await res.json()) as DecolectaResponse;
  } catch {
    return err("lookup_failed");
  }

  const nombres = (body.first_name ?? "").trim();
  const apellidoPaterno = (body.first_last_name ?? "").trim();
  const apellidoMaterno = (body.second_last_name ?? "").trim();

  if (!nombres && !apellidoPaterno && !apellidoMaterno) {
    return err("dni_not_found");
  }

  return ok({ nombres, apellidoPaterno, apellidoMaterno });
};

export const buildFullName = (d: DniData): string =>
  [d.nombres, d.apellidoPaterno, d.apellidoMaterno]
    .filter((s) => s.length > 0)
    .join(" ")
    .toUpperCase();
