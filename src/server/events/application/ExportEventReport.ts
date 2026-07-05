import ExcelJS from "exceljs";
import { Money } from "@/lib/_shared/money";
import { byCode, countryFromE164, DEFAULT_COUNTRY } from "@/lib/phone/countries";
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

// Los teléfonos se guardan en formatos mixtos: `guest_phone` es crudo (lo que
// tecleó la persona, con o sin "+51"), mientras que el del perfil/transferencia
// ya viene solo-dígitos. Los uniformamos a 9 dígitos locales (Perú) quitando el
// prefijo de país cuando el resto queda como un móvil válido (9…). Así la
// columna se ve pareja y sin el "'" que Excel antepone al "+".
const displayPhone = (raw: string | null): string => {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith("0051")) d = d.slice(4);
  if (d.length === 11 && d.startsWith("51") && d[2] === "9") d = d.slice(2);
  return d;
};

// País del teléfono: se deriva del código de marcación del número (+57 →
// Colombia). Los números locales viejos (9 dígitos sin país) se asumen del país
// por defecto (Perú, el venue del piloto). Vacío si no hay teléfono.
const phoneCountry = (raw: string | null): string => {
  if (!raw || !raw.replace(/\D/g, "")) return "";
  const c = countryFromE164(raw) ?? byCode(DEFAULT_COUNTRY);
  return c ? `${c.flag} ${c.label}` : "";
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
  // El nombre del titular por ticket, para resolver el anfitrión de un box
  // ("Invitado por X") sin queries extra: los acompañantes ya vienen en la lista.
  const nameByTicketId = new Map(attendees.map((a) => [a.ticketId, a.holderName]));

  // Tipo de entrada. Para un box, `name`/`boxLabel` es solo la identidad ("A",
  // "VIP Plus Ultra Genial A") y el sustantivo vive en `unitNoun` ("box",
  // "mesa"): se arma "Noun + identidad" salvo que la identidad ya empiece con el
  // sustantivo. Misma regla que boxDisplayLabel en la UI, para no divergir.
  const typeLabel = (a: (typeof attendees)[number]): string => {
    if (!a.boxLabel && !a.unitNoun) return a.ticketTypeName;
    const raw = a.boxLabel ?? a.ticketTypeName;
    if (!a.unitNoun) return raw;
    const noun = a.unitNoun.charAt(0).toUpperCase() + a.unitNoun.slice(1);
    return raw.toLowerCase().startsWith(a.unitNoun.toLowerCase()) ? raw : `${noun} ${raw}`;
  };

  // Tipo: qué ES la fila, no cómo se llama. Un box (tiene box_label) es un
  // "Espacio" grupal (1 lugar para varios); el resto son "Entrada" individual
  // (1 acceso = 1 persona). Misma distinción box/entrada individual del dominio.
  const kindLabel = (a: (typeof attendees)[number]): string =>
    a.boxLabel ? "Espacio" : "Entrada";

  // Origen: de dónde salió esta entrada. Vacío en la compra normal (el 90% — sin
  // ruido); solo se llena el caso que el organizador necesita entender.
  const originLabel = (a: (typeof attendees)[number]): string => {
    if (a.boxLabel && a.boxHostTicketId) {
      const host = nameByTicketId.get(a.boxHostTicketId);
      return host ? `Invitado por ${host}` : "Invitado al box";
    }
    if (a.boxLabel) return "Anfitrión";
    if (a.transferFromName) return `Transferida de ${a.transferFromName}`;
    if (a.isCourtesy) return "Cortesía";
    return "";
  };

  // Orden de la hoja: por tipo, y dentro de un box sus miembros juntos (anfitrión
  // primero); el resto por nombre. Así los espacios no salen mezclados por ID.
  const boxGroup = (a: (typeof attendees)[number]): string =>
    a.boxLabel ? (a.boxHostTicketId ?? a.ticketId) : "";
  const hostRank = (a: (typeof attendees)[number]): number => (a.boxHostTicketId ? 1 : 0);
  const sortedAttendees = [...attendees].sort(
    (a, b) =>
      // numeric: "Box 2" antes de "Box 10" — igual que la grilla de boxes.
      typeLabel(a).localeCompare(typeLabel(b), "es", { numeric: true }) ||
      boxGroup(a).localeCompare(boxGroup(b)) ||
      hostRank(a) - hostRank(b) ||
      (a.holderName ?? "").localeCompare(b.holderName ?? "", "es", { numeric: true }),
  );

  const wsA = wb.addWorksheet("Asistentes");
  wsA.columns = [
    { header: "Ticket", key: "ticketId", width: 12 },
    { header: "Nombre del titular", key: "holderName", width: 28 },
    { header: "DNI", key: "holderDni", width: 16 },
    { header: "Nombre de la entrada", key: "ticketTypeName", width: 20 },
    { header: "Tipo", key: "kind", width: 12 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Ingresó", key: "usedAt", width: 22 },
    { header: "Contacto (WhatsApp)", key: "contactPhone", width: 18 },
    { header: "País de Teléfono", key: "phoneCountry", width: 18 },
    { header: "Email", key: "contactEmail", width: 28 },
    { header: "Origen", key: "origin", width: 24 },
    { header: "Promotor", key: "promoterCode", width: 18 },
    { header: "Orden", key: "orderId", width: 12 },
  ];
  for (const a of sortedAttendees) {
    wsA.addRow({
      ticketId: shortId(a.ticketId),
      holderName: safeCell(a.holderName),
      // "··1234" era críptico para compras viejas sin DNI completo.
      holderDni: safeCell(
        a.holderDni?.startsWith("··") ? `Termina en ${a.holderDni.slice(2)}` : a.holderDni,
      ),
      ticketTypeName: safeCell(typeLabel(a)),
      kind: kindLabel(a),
      // Una cortesía nace con status 'active' (el constraint de tickets no admite
      // otro estado), pero conceptualmente está "Enviada" hasta que el invitado
      // ingresa — mismo copy que el panel de cortesías. Cuando entra pasa a
      // 'used' → "Usada".
      status:
        a.isCourtesy && a.status === "active"
          ? "Enviada"
          : (STATUS_LABEL[a.status] ?? a.status),
      usedAt: toLimaDate(a.usedAt) ?? "",
      contactPhone: safeCell(displayPhone(a.contactPhone)),
      phoneCountry: phoneCountry(a.contactPhone),
      contactEmail: safeCell(displayEmail(a.contactEmail)),
      origin: safeCell(originLabel(a)),
      promoterCode: safeCell(a.promoterCode),
      orderId: shortId(a.orderId),
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
    // Dos ejes: % por venta (siempre) + metas. "A pagar" = dinero (% + hitos
    // cash) y, si hay, los premios en especie desbloqueados como texto.
    const perks = p.unlockedRewards.length > 0 ? ` + En especie: ${p.unlockedRewards.join(", ")}` : "";
    const soles = Money.toSoles(p.commissionCalculatedCents);
    wsP.addRow({
      name: safeCell(p.name),
      code: safeCell(p.code),
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
      guestsInvited: p.guestsInvited,
      guestsEntered: p.guestsEntered,
      revenue: Money.toSoles(p.revenueCents),
      commissionPct: p.commissionPct / 100,
      commission: perks ? `S/ ${soles}${perks}` : soles,
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
