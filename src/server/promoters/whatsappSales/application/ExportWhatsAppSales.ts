import ExcelJS from "exceljs";
import { Money } from "@/lib/_shared/money";
import type { WhatsAppSale } from "../domain/WhatsAppSale";

const STATUS_LABEL: Record<WhatsAppSale["status"], string> = {
  pending_payment: "Pendiente",
  paid: "Pagada",
  rejected: "Rechazada",
};

const SOLES_FMT = '"S/" #,##0.00';

// Mismo protector que ExportEventReport: un comprobante o nombre que empiece
// con = + - @ se ejecutaría como fórmula al abrir el archivo en Excel.
const safeCell = (v: string | null | undefined): string => {
  const s = v ?? "";
  return /^[=+\-@\t\r\n]/.test(s) ? `'${s}` : s;
};

// El promotor pidió justamente esto sin tener que hacer nada — un Excel con
// todas sus ventas, sin acción manual de su parte (ver docs del MVP).
export const exportWhatsAppSales = async (
  promoterName: string,
  sales: WhatsAppSale[],
): Promise<{ buffer: Buffer; filename: string }> => {
  const wb = new ExcelJS.Workbook();
  wb.creator = "pasape";
  wb.created = new Date();

  const ws = wb.addWorksheet("Ventas WhatsApp");
  ws.columns = [
    { header: "Código", key: "code", width: 12 },
    { header: "Comprador (WhatsApp)", key: "buyerPhone", width: 18 },
    { header: "Descripción", key: "description", width: 24 },
    { header: "Monto", key: "amount", width: 14 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Fecha", key: "createdAt", width: 20 },
    { header: "Fecha de pago", key: "paidAt", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const s of sales) {
    const row = ws.addRow({
      code: s.confirmationCode,
      buyerPhone: safeCell(s.buyerPhone),
      description: safeCell(s.description ?? ""),
      amount: Money.toSoles(s.amountCents),
      status: STATUS_LABEL[s.status],
      createdAt: new Date(s.createdAt),
      paidAt: s.paidAt ? new Date(s.paidAt) : "",
    });
    row.getCell("amount").numFmt = SOLES_FMT;
    row.getCell("createdAt").numFmt = "yyyy-mm-dd hh:mm";
    row.getCell("paidAt").numFmt = "yyyy-mm-dd hh:mm";
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const filename = `ventas-whatsapp-${promoterName.toLowerCase().replace(/\s+/g, "-")}.xlsx`;
  return { buffer, filename };
};
