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
    { header: "Ticket ID", key: "ticketId", width: 38 },
    { header: "Nombre del titular", key: "holderName", width: 28 },
    { header: "Tipo de ticket", key: "ticketTypeName", width: 18 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Usado en", key: "usedAt", width: 22 },
    { header: "Order ID", key: "orderId", width: 38 },
    { header: "Email comprador", key: "buyerEmail", width: 28 },
    { header: "Teléfono comprador", key: "buyerPhone", width: 18 },
    { header: "Código promotor", key: "promoterCode", width: 16 },
  ];
  for (const a of attendees) {
    wsA.addRow({
      ticketId: a.ticketId,
      holderName: safeCell(a.holderName),
      ticketTypeName: safeCell(a.ticketTypeName),
      status: STATUS_LABEL[a.status] ?? a.status,
      usedAt: toLimaDate(a.usedAt) ?? "",
      orderId: a.orderId,
      buyerEmail: safeCell(a.buyerEmail),
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
    { header: "Recaudado (S/)", key: "revenue", width: 18 },
    { header: "Comisión (%)", key: "commissionPct", width: 14 },
    { header: "Comisión calculada (S/)", key: "commission", width: 22 },
  ];
  for (const p of promoters) {
    wsP.addRow({
      name: safeCell(p.name),
      code: safeCell(p.code),
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
      guestsInvited: p.guestsInvited,
      guestsEntered: p.guestsEntered,
      revenue: Money.toSoles(p.revenueCents),
      commissionPct: p.commissionPct,
      commission: Money.toSoles(p.commissionCalculatedCents),
    });
  }
  wsP.getColumn("revenue").numFmt = "#,##0.00";
  wsP.getColumn("commission").numFmt = "#,##0.00";
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
  wsS.addRow({ k: "Estado", v: event.status });
  wsS.addRow({ k: "" });
  wsS.addRow({ k: "Tickets vendidos", v: summary.sold });
  wsS.addRow({ k: "Tickets validados", v: summary.validated });
  wsS.addRow({ k: "Capacidad total", v: summary.capacity ?? "—" });
  wsS.addRow({ k: "Recaudado (S/)", v: Money.toSoles(summary.revenueCents) });
  wsS.addRow({ k: "" });
  wsS.addRow({ k: "Desglose por tipo de ticket", v: "" }).font = { bold: true };
  wsS.addRow({ k: "Tipo", v: "Vendidos / Capacidad / Recaudado (S/)" }).font = {
    italic: true,
  };
  for (const t of summary.ticketTypes) {
    wsS.addRow({
      k: safeCell(t.name),
      v: `${t.sold} / ${t.capacity} / ${Money.toSoles(t.revenueCents).toFixed(2)}`,
    });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const filename = `${event.slug}-reporte.xlsx`;
  return { buffer, filename };
};
