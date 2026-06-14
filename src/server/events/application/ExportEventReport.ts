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
      holderName: a.holderName ?? "",
      ticketTypeName: a.ticketTypeName,
      status: STATUS_LABEL[a.status] ?? a.status,
      usedAt: a.usedAt ?? "",
      orderId: a.orderId,
      buyerEmail: a.buyerEmail ?? "",
      buyerPhone: a.buyerPhone ?? "",
      promoterCode: a.promoterCode ?? "",
    });
  }
  wsA.getRow(1).font = { bold: true };

  // ---- Hoja Promotores ----
  const wsP = wb.addWorksheet("Promotores");
  wsP.columns = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Código", key: "code", width: 16 },
    { header: "Tickets vendidos", key: "ticketsSold", width: 18 },
    { header: "Tickets validados", key: "ticketsValidated", width: 18 },
    { header: "Recaudado (S/)", key: "revenue", width: 18 },
    { header: "Comisión (%)", key: "commissionPct", width: 14 },
    { header: "Comisión calculada (S/)", key: "commission", width: 22 },
  ];
  for (const p of promoters) {
    wsP.addRow({
      name: p.name,
      code: p.code,
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
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
  wsS.addRow({ k: "Evento", v: event.title });
  wsS.addRow({ k: "Slug", v: event.slug });
  wsS.addRow({ k: "Inicio", v: event.startsAt });
  wsS.addRow({ k: "Venue", v: event.venue ?? "" });
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
      k: t.name,
      v: `${t.sold} / ${t.capacity} / ${Money.toSoles(t.revenueCents).toFixed(2)}`,
    });
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const filename = `${event.slug}-reporte.xlsx`;
  return { buffer, filename };
};
