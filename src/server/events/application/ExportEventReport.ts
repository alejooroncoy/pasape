import ExcelJS from "exceljs";
import { Money } from "@/lib/_shared/money";
import type { Event } from "../domain/Event";
import type { EventRepository } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  used: "Usada",
  void: "Anulada",
  refunded: "Reembolsada",
};

const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  closed: "Finalizado",
  cancelled: "Cancelado",
};

// Formato de moneda para celdas: se ve "S/ 150.00" pero la celda sigue siendo
// un número (se puede sumar/ordenar en Excel).
const SOLES_FMT = '"S/" #,##0.00';

// Los UUID crudos (38 chars) son ruido para el organizador: mostramos un código
// corto (8 chars) que igual sirve para buscar/reportar un ticket u orden.
const shortId = (uuid: string): string => uuid.slice(0, 8).toUpperCase();

// Email sintético de guest checkout (guest+<uuid>@pasape.app) — ruido técnico
// para el organizador; el contacto real de esas compras es el WhatsApp.
const displayEmail = (email: string | null): string =>
  email && /^guest\+.*@pasape\.app$/i.test(email) ? "Invitado (sin email)" : (email ?? "");

// Anti CSV/Excel injection: un valor de usuario que empiece con = + - @ o un
// control (TAB/CR/LF) se ejecuta como fórmula al abrir el archivo. Lo
// neutralizamos prefijando una comilla simple (Excel la trata como texto).
const safeCell = (v: string | null | undefined): string => {
  const s = v ?? "";
  return /^[=+\-@\t\r\n]/.test(s) ? `'${s}` : s;
};

// Fecha ISO (UTC) → Date con la hora de pared de Lima (UTC-5), para que Excel la
// muestre en horario local y la trate como fecha real (con numFmt). El server
// corre en UTC, así que construir el Date desde los componentes de Lima da el
// serial correcto.
const toLimaDate = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")),
  );
};

export const exportEventReport = async (
  { repo }: Deps,
  event: Event,
): Promise<{ buffer: Buffer; filename: string }> => {
  const { attendees, promoters, summary } = await repo.exportData(event.id);

  const wb = new ExcelJS.Workbook();
  wb.creator = "pasape";
  wb.created = new Date();

  // ---- Hoja Asistentes ----
  const wsA = wb.addWorksheet("Asistentes");
  wsA.columns = [
    { header: "Ticket", key: "ticketId", width: 12 },
    { header: "Nombre del titular", key: "holderName", width: 28 },
    { header: "DNI", key: "holderDni", width: 16 },
    { header: "Tipo de entrada", key: "ticketTypeName", width: 18 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Ingresó", key: "usedAt", width: 22 },
    { header: "Orden", key: "orderId", width: 12 },
    { header: "Email comprador", key: "buyerEmail", width: 28 },
    { header: "Teléfono comprador", key: "buyerPhone", width: 18 },
    { header: "Promotor", key: "promoterCode", width: 18 },
  ];
  for (const a of attendees) {
    wsA.addRow({
      ticketId: shortId(a.ticketId),
      holderName: safeCell(a.holderName),
      // "··1234" era críptico para compras viejas sin DNI completo.
      holderDni: safeCell(
        a.holderDni?.startsWith("··") ? `Termina en ${a.holderDni.slice(2)}` : a.holderDni,
      ),
      ticketTypeName: safeCell(a.ticketTypeName),
      status: STATUS_LABEL[a.status] ?? a.status,
      usedAt: toLimaDate(a.usedAt) ?? "",
      orderId: shortId(a.orderId),
      buyerEmail: safeCell(displayEmail(a.buyerEmail)),
      buyerPhone: safeCell(a.buyerPhone),
      promoterCode: safeCell(a.promoterCode),
    });
  }
  wsA.getColumn("usedAt").numFmt = "yyyy-mm-dd hh:mm";
  wsA.getRow(1).font = { bold: true };

  // ---- Hoja Promotores ----
  const wsP = wb.addWorksheet("Promotores");
  wsP.columns = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Código", key: "code", width: 16 },
    { header: "Tickets vendidos", key: "ticketsSold", width: 18 },
    { header: "Tickets validados", key: "ticketsValidated", width: 18 },
    { header: "Invitados (cortesías)", key: "guestsInvited", width: 20 },
    { header: "Invitados que entraron", key: "guestsEntered", width: 22 },
    { header: "Recaudado", key: "revenue", width: 16 },
    { header: "Comisión", key: "commissionPct", width: 12 },
    { header: "A pagar", key: "commission", width: 22 },
  ];
  for (const p of promoters) {
    const inkind = p.commissionType === "inkind";
    wsP.addRow({
      name: safeCell(p.name),
      code: safeCell(p.code),
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
      guestsInvited: p.guestsInvited,
      guestsEntered: p.guestsEntered,
      revenue: Money.toSoles(p.revenueCents),
      // En especie no tiene % ni monto: mostrarlo como texto evita el "0.00"
      // que parecía "no se le debe nada". Por hitos tampoco es un % fijo.
      commissionPct: inkind
        ? "—"
        : p.commissionType === "tiered"
          ? "Por hitos"
          : p.commissionPct / 100,
      commission: inkind
        ? p.unlockedRewards.length > 0
          ? `En especie: ${p.unlockedRewards.join(", ")}`
          : "En especie"
        : Money.toSoles(p.commissionCalculatedCents),
    });
  }
  wsP.getColumn("revenue").numFmt = SOLES_FMT;
  wsP.getColumn("commissionPct").numFmt = "0%";
  wsP.getColumn("commission").numFmt = SOLES_FMT;
  wsP.getRow(1).font = { bold: true };

  // ---- Hoja Resumen ----
  const wsS = wb.addWorksheet("Resumen");
  wsS.columns = [
    { header: "Métrica", key: "k", width: 32 },
    { header: "Valor", key: "v", width: 24 },
  ];
  wsS.getRow(1).font = { bold: true };
  wsS.addRow({ k: "Evento", v: safeCell(event.title) });
  wsS.addRow({ k: "Slug", v: safeCell(event.slug) });
  const startsAtRow = wsS.addRow({ k: "Inicio", v: toLimaDate(event.startsAt) ?? "" });
  startsAtRow.getCell("v").numFmt = "yyyy-mm-dd hh:mm";
  wsS.addRow({ k: "Venue", v: safeCell(event.venue) });
  wsS.addRow({ k: "Estado", v: EVENT_STATUS_LABEL[event.status] ?? event.status });
  wsS.addRow({ k: "" });
  wsS.addRow({ k: "Entradas vendidas", v: summary.sold });
  wsS.addRow({ k: "Entradas validadas", v: summary.validated });
  wsS.addRow({ k: "Capacidad total", v: summary.capacity ?? "—" });
  const revenueRow = wsS.addRow({ k: "Recaudado (pagado por compradores)", v: Money.toSoles(summary.revenueCents) });
  revenueRow.getCell("v").numFmt = SOLES_FMT;
  const feeRow = wsS.addRow({ k: "Servicio Pasape", v: Money.toSoles(summary.serviceFeeCents) });
  feeRow.getCell("v").numFmt = SOLES_FMT;
  const netRow = wsS.addRow({ k: "Neto para ti", v: Money.toSoles(summary.netCents) });
  netRow.getCell("v").numFmt = SOLES_FMT;
  netRow.font = { bold: true };
  wsS.addRow({ k: "" });
  // Mini-tabla real (columnas separadas) para poder ordenar/sumar en Excel —
  // antes era un string "12 / 50 / 600.00" en una sola celda.
  wsS.addRow({ k: "Desglose por tipo de entrada" }).font = { bold: true };
  const headerRow = wsS.addRow({ k: "Tipo", v: "Vendidas" });
  headerRow.getCell(3).value = "Capacidad";
  headerRow.getCell(4).value = "Recaudado";
  headerRow.font = { italic: true };
  for (const t of summary.ticketTypes) {
    const row = wsS.addRow({ k: safeCell(t.name), v: t.sold });
    row.getCell(3).value = t.capacity;
    row.getCell(4).value = Money.toSoles(t.revenueCents);
    row.getCell(4).numFmt = SOLES_FMT;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const filename = `${event.slug}-reporte.xlsx`;
  return { buffer, filename };
};
