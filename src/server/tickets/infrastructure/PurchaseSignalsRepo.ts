import "server-only";
import { supabaseAdmin } from "@/server/_shared/supabase/admin";
import type { PurchasePhase } from "../domain/botScore";
import { enforcementMode, type EnforcementMode, type SignalAction } from "../domain/botEnforcement";

// Persistencia y agregación de purchase_signals. Todo por service-role (la tabla
// no es accesible por el cliente). Las agregaciones corren en paralelo y son la
// entrada de volumen/correlación del scorer.

const WINDOW_SHORT_MS = 60_000; // ráfagas: ~1 min
const WINDOW_FLOW_MS = 15 * 60_000; // flujo quote→buy: ~15 min (checkout largo)
const WINDOW_DAY_MS = 24 * 60 * 60 * 1000; // identidades por device: ~1 día
const WINDOW_HOUR_MS = 60 * 60 * 1000; // pagos fallidos (carding): ~1 h

export type SignalAggregates = {
  deviceAttemptsShort: number;
  deviceContactsDay: number;
  deviceDnisDay: number;
  dniDevicesDay: number;
  deviceIpsHour: number;
  deviceQuotesShort: number;
  ipAttemptsShort: number;
  contactAttemptsShort: number;
  ipFailedPaymentsHour: number;
  deviceFailedPaymentsHour: number;
};

const EMPTY_AGG: SignalAggregates = {
  deviceAttemptsShort: 0,
  deviceContactsDay: 0,
  deviceDnisDay: 0,
  dniDevicesDay: 0,
  deviceIpsHour: 0,
  deviceQuotesShort: 0,
  ipAttemptsShort: 0,
  contactAttemptsShort: 0,
  ipFailedPaymentsHour: 0,
  deviceFailedPaymentsHour: 0,
};

const iso = (msAgo: number): string => new Date(Date.now() - msAgo).toISOString();

const countBy = async (
  column: "device_hash" | "ip" | "contact_hash",
  value: string,
  sinceMs: number,
  phase?: PurchasePhase,
): Promise<number> => {
  let q = supabaseAdmin()
    .from("purchase_signals")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", iso(sinceMs));
  if (phase) q = q.eq("phase", phase);
  const { count } = await q;
  return count ?? 0;
};

// PostgREST no hace COUNT(DISTINCT) directo: traemos la columna en la ventana
// (acotada) y contamos distintos en memoria. Suficiente para el rango de una
// granja; el cap evita traer historiales largos.
const distinctInWindow = async (
  matchCol: "device_hash" | "dni_hash",
  matchVal: string,
  distinctCol: "contact_hash" | "dni_hash" | "device_hash" | "ip",
  windowMs: number = WINDOW_DAY_MS,
): Promise<number> => {
  const { data } = await supabaseAdmin()
    .from("purchase_signals")
    .select(distinctCol)
    .eq(matchCol, matchVal)
    .not(distinctCol, "is", null)
    .gte("created_at", iso(windowMs))
    .limit(500);
  if (!data) return 0;
  // El select de columna dinámica confunde el tipado de PostgREST (union); las
  // filas son { [distinctCol]: string|null }.
  const rows = data as unknown as Array<Record<string, string | null>>;
  return new Set(rows.map((r) => r[distinctCol]).filter((v): v is string => !!v)).size;
};

export const purchaseSignalsRepo = {
  /**
   * Agrega las señales de volumen/correlación para este intento. Corre las
   * consultas en paralelo; un fallo de una sub-consulta no debe tumbar la
   * compra (devuelve 0 en esa dimensión — degrada a menos señales, nunca a
   * bloquear por error). Fail-open coherente con el resto del stack.
   */
  async aggregates(keys: {
    deviceHash: string | null;
    ip: string | null;
    contactHash: string | null;
    dniHash: string | null;
  }): Promise<SignalAggregates> {
    const { deviceHash, ip, contactHash, dniHash } = keys;
    try {
      const [
        deviceAttemptsShort,
        deviceContactsDay,
        deviceDnisDay,
        dniDevicesDay,
        deviceIpsHour,
        deviceQuotesShort,
        ipAttemptsShort,
        contactAttemptsShort,
        ipFailedPaymentsHour,
        deviceFailedPaymentsHour,
      ] = await Promise.all([
        deviceHash ? countBy("device_hash", deviceHash, WINDOW_SHORT_MS) : 0,
        deviceHash ? distinctInWindow("device_hash", deviceHash, "contact_hash") : 0,
        // Anti-multicuenta: cuántos DNIs distintos salieron de este device.
        deviceHash ? distinctInWindow("device_hash", deviceHash, "dni_hash") : 0,
        // Anti-multicuenta: desde cuántos devices distintos apareció este DNI
        // (un DNI reusado a través de una granja de devices rotados).
        dniHash ? distinctInWindow("dni_hash", dniHash, "device_hash") : 0,
        // Anti-multiproxy: cuántas IPs distintas usó este device en ~1 h. Un
        // device que salta de muchas IPs está rotando proxies (un humano usa 1-3).
        deviceHash ? distinctInWindow("device_hash", deviceHash, "ip", WINDOW_HOUR_MS) : 0,
        // Quotes previos del device (ventana media): si es 0 al comprar, el
        // flujo humano (cotizar antes de pagar) se saltó.
        deviceHash ? countBy("device_hash", deviceHash, WINDOW_FLOW_MS, "quote") : 0,
        ip ? countBy("ip", ip, WINDOW_SHORT_MS) : 0,
        contactHash ? countBy("contact_hash", contactHash, WINDOW_SHORT_MS) : 0,
        ip ? countBy("ip", ip, WINDOW_HOUR_MS, "webhook_failed") : 0,
        deviceHash ? countBy("device_hash", deviceHash, WINDOW_HOUR_MS, "webhook_failed") : 0,
      ]);
      return {
        deviceAttemptsShort,
        deviceContactsDay,
        deviceDnisDay,
        dniDevicesDay,
        deviceIpsHour,
        deviceQuotesShort,
        ipAttemptsShort,
        contactAttemptsShort,
        ipFailedPaymentsHour,
        deviceFailedPaymentsHour,
      };
    } catch (e) {
      console.warn("[antibot] fallo agregando señales (fail-open, score parcial):", e);
      return EMPTY_AGG;
    }
  },

  /**
   * Inserta la fila de señal y devuelve su id (para adjuntar el order_id después
   * de crear la orden). Nunca lanza: registrar no debe romper la compra.
   */
  async record(row: {
    phase: PurchasePhase;
    eventId: string | null;
    ticketTypeIds: string[] | null;
    orderId: string | null;
    qty: number | null;
    ip: string | null;
    userAgent: string | null;
    deviceHash: string | null;
    buyerId: string | null;
    contactHash: string | null;
    dniHash: string | null;
    checkoutTokenOk: boolean;
    msSinceMount: number | null;
    botScore: number;
    reasons: string[];
    enforcementMode: EnforcementMode;
    actionTaken: SignalAction;
  }): Promise<string | null> {
    try {
      const { data } = await supabaseAdmin()
        .from("purchase_signals")
        .insert({
          phase: row.phase,
          event_id: row.eventId,
          ticket_type_ids: row.ticketTypeIds,
          order_id: row.orderId,
          qty: row.qty,
          ip: row.ip,
          user_agent: row.userAgent,
          device_hash: row.deviceHash,
          buyer_id: row.buyerId,
          contact_hash: row.contactHash,
          dni_hash: row.dniHash,
          checkout_token_ok: row.checkoutTokenOk,
          ms_since_mount: row.msSinceMount,
          bot_score: row.botScore,
          reasons: row.reasons,
          enforcement_mode: row.enforcementMode,
          action_taken: row.actionTaken,
        })
        .select("id")
        .single<{ id: string }>();
      return data?.id ?? null;
    } catch (e) {
      console.warn("[antibot] fallo registrando señal (ignorado):", e);
      return null;
    }
  },

  /** Adjunta el order_id a una señal ya registrada (tras crear la orden). */
  async attachOrder(signalId: string, orderId: string): Promise<void> {
    try {
      await supabaseAdmin()
        .from("purchase_signals")
        .update({ order_id: orderId })
        .eq("id", signalId);
    } catch (e) {
      console.warn("[antibot] fallo adjuntando order_id a señal (ignorado):", e);
    }
  },

  /**
   * CARDING: registra el desenlace del pago (webhook). Copia device_hash/ip del
   * intento de compra original (por order_id) para que los rechazos se
   * correlacionen con el device/ip real del comprador — la IP del webhook es de
   * Mercado Pago y no sirve. No bloqueante.
   */
  async recordPaymentOutcome(orderId: string, paid: boolean): Promise<void> {
    try {
      const { data: origin } = await supabaseAdmin()
        .from("purchase_signals")
        .select("device_hash, ip, event_id, buyer_id, contact_hash, dni_hash")
        .eq("order_id", orderId)
        .eq("phase", "buy")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          device_hash: string | null;
          ip: string | null;
          event_id: string | null;
          buyer_id: string | null;
          contact_hash: string | null;
          dni_hash: string | null;
        }>();
      await supabaseAdmin().from("purchase_signals").insert({
        phase: paid ? "webhook_paid" : "webhook_failed",
        order_id: orderId,
        event_id: origin?.event_id ?? null,
        device_hash: origin?.device_hash ?? null,
        ip: origin?.ip ?? null,
        buyer_id: origin?.buyer_id ?? null,
        contact_hash: origin?.contact_hash ?? null,
        dni_hash: origin?.dni_hash ?? null,
        checkout_token_ok: false,
        bot_score: 0,
        reasons: [],
        enforcement_mode: enforcementMode(),
        action_taken: "logged",
      });
    } catch (e) {
      console.warn("[antibot] fallo registrando outcome de pago (ignorado):", e);
    }
  },
};
