import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import {
  PLAZO_RESPUESTA_DIAS_HABILES,
  PROVEEDOR,
  TIPO_BIEN_LABEL,
  TIPO_DOCUMENTO_LABEL,
  TIPO_RECLAMACION_LABEL,
  formatCodigoReclamacion,
  type ComplaintSubmission,
} from "@/lib/legal/complaintBook";
import { encryptText, maskDocNumber, maskEmail } from "@/server/_shared/crypto/pii";

const schema = z
  .object({
    tipo: z.enum(["reclamo", "queja"]),
    nombre: z.string().trim().min(2).max(160),
    tipoDocumento: z.enum(["dni", "ce", "pasaporte"]),
    numeroDocumento: z.string().trim().min(4).max(32),
    domicilio: z.string().trim().min(4).max(240),
    telefono: z.string().trim().max(32).optional().or(z.literal("")),
    email: z.string().trim().email().max(160),
    esMenorDeEdad: z.boolean(),
    apoderado: z.string().trim().max(160).optional().or(z.literal("")),
    tipoBien: z.enum(["producto", "servicio"]),
    montoSoles: z.number().nonnegative().max(1_000_000).optional(),
    descripcionBien: z.string().trim().min(3).max(500),
    detalle: z.string().trim().min(10).max(3000),
    pedido: z.string().trim().min(5).max(2000),
    aceptaDeclaracion: z.literal(true),
  })
  .refine((d) => !d.esMenorDeEdad || (d.apoderado ?? "").trim().length >= 2, {
    path: ["apoderado"],
    message: "Si el consumidor es menor de edad, indica al padre/madre o apoderado.",
  });

// Rate limit in-memory: 3 reclamos/10min por IP. Mitiga spam sin bloquear al usuario legítimo.
type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();
const consumeRate = (ip: string): boolean => {
  const now = Date.now();
  const b = BUCKETS.get(ip);
  if (!b || now > b.resetAt) {
    BUCKETS.set(ip, { count: 1, resetAt: now + 600_000 });
    return true;
  }
  if (b.count >= 3) return false;
  b.count += 1;
  return true;
};

const ipOf = (req: NextRequest): string =>
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  req.headers.get("x-real-ip") ??
  "unknown";

const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const soles = (cents: number): string => `S/ ${(cents / 100).toFixed(2)}`;

// Envío best-effort de la constancia al consumidor + aviso al proveedor.
// Degrada a no-op si Resend no está configurado — nunca bloquea el registro.
const sendConstancia = async (
  data: ComplaintSubmission,
  codigo: string,
  fechaFmt: string,
  montoCents: number | null,
): Promise<void> => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[complaint-book] Resend no configurado — constancia no enviada por email");
    return;
  }
  const mod = (await import("resend").catch(() => null)) as
    | { Resend: new (k: string) => { emails: { send: (a: unknown) => Promise<unknown> } } }
    | null;
  if (!mod) return;
  const client = new mod.Resend(apiKey);

  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#8a8aa0;vertical-align:top;white-space:nowrap">${label}</td><td style="padding:6px 0;color:#fff">${value}</td></tr>`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;background:#0A0A0F;color:#fff;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#140C28;border-radius:16px;padding:28px">
    <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8aa0">Libro de Reclamaciones</div>
    <h1 style="font-size:22px;margin:6px 0 4px">Constancia ${esc(codigo)}</h1>
    <p style="color:rgba(255,255,255,0.7);margin:0 0 18px">Recibimos tu ${esc(TIPO_RECLAMACION_LABEL[data.tipo].toLowerCase())}. Te responderemos en un plazo máximo de ${PLAZO_RESPUESTA_DIAS_HABILES} días hábiles al correo ${esc(data.email)}.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid rgba(255,255,255,.1);padding-top:12px">
      ${row("Código", esc(codigo))}
      ${row("Fecha", esc(fechaFmt))}
      ${row("Tipo", esc(TIPO_RECLAMACION_LABEL[data.tipo]))}
      ${row("Consumidor", esc(data.nombre))}
      ${row("Documento", `${esc(TIPO_DOCUMENTO_LABEL[data.tipoDocumento])} ${esc(data.numeroDocumento)}`)}
      ${row("Bien contratado", esc(TIPO_BIEN_LABEL[data.tipoBien]))}
      ${montoCents != null ? row("Monto reclamado", soles(montoCents)) : ""}
      ${row("Descripción", esc(data.descripcionBien))}
      ${row("Detalle", esc(data.detalle))}
      ${row("Pedido", esc(data.pedido))}
    </table>
    <p style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:22px;line-height:1.5">
      Proveedor: ${esc(PROVEEDOR.razonSocial)} — RUC ${esc(PROVEEDOR.ruc)}. ${esc(PROVEEDOR.direccion)}.<br/>
      Conserva este correo como constancia de tu ${esc(TIPO_RECLAMACION_LABEL[data.tipo].toLowerCase())}.
    </p>
  </div>
</body></html>`;

  try {
    await client.emails.send({
      from,
      to: data.email,
      subject: `Constancia ${codigo} — Libro de Reclamaciones ${PROVEEDOR.nombreComercial}`,
      html,
    });
    // Aviso interno al proveedor (best-effort).
    await client.emails.send({
      from,
      to: PROVEEDOR.email,
      subject: `Nuevo ${TIPO_RECLAMACION_LABEL[data.tipo].toLowerCase()} ${codigo}`,
      html,
    });
  } catch (err) {
    console.error("[complaint-book] envío de constancia falló:", err instanceof Error ? err.message : err);
  }
};

export const POST = async (req: NextRequest) => {
  if (!consumeRate(ipOf(req))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;
  const montoCents = d.montoSoles != null ? Math.round(d.montoSoles * 100) : null;

  const db = supabaseAdmin();
  const { data: inserted, error } = await db
    .from("complaint_book")
    .insert({
      tipo: d.tipo,
      nombre: d.nombre.slice(0, 1) + "***",
      tipo_documento: d.tipoDocumento,
      numero_documento: maskDocNumber(d.numeroDocumento),
      domicilio: "[protegido]",
      telefono: d.telefono ? "***" : null,
      email: maskEmail(d.email.toLowerCase()),
      es_menor_de_edad: d.esMenorDeEdad,
      apoderado: d.apoderado ? "[protegido]" : null,
      tipo_bien: d.tipoBien,
      monto_cents: montoCents,
      descripcion_bien: d.descripcionBien,
      detalle: "[protegido]",
      pedido: "[protegido]",
      nombre_enc: encryptText(d.nombre),
      numero_documento_enc: encryptText(d.numeroDocumento),
      domicilio_enc: encryptText(d.domicilio),
      telefono_enc: encryptText(d.telefono || null),
      email_enc: encryptText(d.email.toLowerCase()),
      apoderado_enc: encryptText(d.apoderado || null),
      detalle_enc: encryptText(d.detalle),
      pedido_enc: encryptText(d.pedido),
    })
    .select("correlativo, created_at")
    .single();

  if (error || !inserted) {
    console.error("[complaint-book] insert falló:", error?.message);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const codigo = formatCodigoReclamacion(Number(inserted.correlativo));
  const fechaFmt = (() => {
    try {
      return new Intl.DateTimeFormat("es-PE", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(new Date(inserted.created_at));
    } catch {
      return inserted.created_at;
    }
  })();

  // No bloquear la respuesta por el email: la constancia también se muestra en pantalla.
  void sendConstancia(d, codigo, fechaFmt, montoCents);

  return NextResponse.json({ data: { codigo, fecha: fechaFmt } });
};
