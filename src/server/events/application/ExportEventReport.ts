import ExcelJS from "exceljs";
import { Money } from "@/lib/_shared/money";
import { byCode, countryFromE164, DEFAULT_COUNTRY } from "@/lib/phone/countries";
import { documentType } from "@/lib/identity/document";
import { eventStatusLabel } from "@/lib/events/eventStatusDisplay";
import type { Event } from "../domain/Event";
import type { EventRepository } from "../ports/EventRepository";

type Deps = { repo: EventRepository };

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  used: "Usada",
  void: "Anulada",
  refunded: "Reembolsada",
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

// País del teléfono, derivado del código de marcación del E.164 (+57 → Colombia).
// Los números locales viejos (9 díg sin país) se asumen del país por defecto
// (Perú, el venue del piloto). Vacío si no hay teléfono.
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

// Nombre de la entrada tal como lo ve el organizador. Para un box, `name`/`boxLabel`
// es solo la identidad ("A", "VIP Plus A") y el sustantivo vive en `unitNoun`
// ("box", "mesa"): se arma "Noun + identidad" salvo que la identidad ya empiece
// con el sustantivo. Misma regla que boxDisplayLabel en la UI, para no divergir.
// Compartido por la hoja Asistentes y el desglose del Resumen (mismo nombre en
// ambos lados).
const entradaLabel = (x: {
  name: string;
  boxLabel: string | null;
  unitNoun: string | null;
}): string => {
  if (!x.boxLabel && !x.unitNoun) return x.name;
  const raw = x.boxLabel ?? x.name;
  if (!x.unitNoun) return raw;
  const noun = x.unitNoun.charAt(0).toUpperCase() + x.unitNoun.slice(1);
  return raw.toLowerCase().startsWith(x.unitNoun.toLowerCase()) ? raw : `${noun} ${raw}`;
};

// Tipo: qué ES la fila, no cómo se llama. Un box es un "Espacio" grupal (1 lugar
// para varios); el resto son "Entrada" individual (1 acceso = 1 persona). Misma
// distinción box/entrada individual del dominio.
const kindLabelFor = (isBox: boolean): string => (isBox ? "Espacio" : "Entrada");

// answers viene keyed por field.id (uuid) — ilegible en una columna de Excel.
// La convertimos a texto plano con el label real de la pregunta.
const formatCustomFieldAnswer = (v: string | string[] | boolean | undefined): string => {
  if (v === undefined) return "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return v;
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

  const typeLabel = (a: (typeof attendees)[number]): string =>
    entradaLabel({ name: a.ticketTypeName, boxLabel: a.boxLabel, unitNoun: a.unitNoun });

  const kindLabel = (a: (typeof attendees)[number]): string => kindLabelFor(!!a.boxLabel);

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
    { header: "Código de entrada", key: "ticketId", width: 16 },
    { header: "Nombre del titular", key: "holderName", width: 28 },
    { header: "Documento", key: "holderDni", width: 16 },
    { header: "Tipo de documento", key: "docType", width: 16 },
    { header: "Nombre de la entrada", key: "ticketTypeName", width: 20 },
    { header: "Tipo", key: "kind", width: 12 },
    { header: "Estado", key: "status", width: 14 },
    { header: "Hora de ingreso", key: "usedAt", width: 22 },
    { header: "Contacto (WhatsApp)", key: "contactPhone", width: 18 },
    { header: "País del teléfono", key: "phoneCountry", width: 18 },
    { header: "Email", key: "contactEmail", width: 28 },
    { header: "Origen de la entrada", key: "origin", width: 24 },
    { header: "Promotor", key: "promoterCode", width: 18 },
    { header: "Código de compra", key: "orderId", width: 18 },
    // Una columna por pregunta de registro del organizador (estilo Luma) — el
    // header es el label real, no el uuid crudo de custom_field_answers.
    ...event.customFields.map((f) => ({
      header: f.label,
      key: `cf_${f.id}`,
      width: 24,
    })),
  ];
  for (const a of sortedAttendees) {
    const customFieldCells = Object.fromEntries(
      event.customFields.map((f) => [
        `cf_${f.id}`,
        safeCell(formatCustomFieldAnswer(a.customFieldAnswers[f.id])),
      ]),
    );
    wsA.addRow({
      ticketId: shortId(a.ticketId),
      holderName: safeCell(a.holderName),
      // "··1234" era críptico para compras viejas sin DNI completo.
      holderDni: safeCell(
        a.holderDni?.startsWith("··") ? `Termina en ${a.holderDni.slice(2)}` : a.holderDni,
      ),
      docType: documentType(a.holderDni) ?? "",
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
      ...customFieldCells,
    });
  }
  wsA.getColumn("usedAt").numFmt = "yyyy-mm-dd hh:mm";
  wsA.getRow(1).font = { bold: true };

  // ---- Hoja Promotores ----
  type PromoterRow = (typeof promoters)[number];
  // Base de las metas: contra qué se miden (ventas o gente que entró). "—" si el
  // promotor no tiene metas configuradas.
  const basisLabel = (b: PromoterRow["milestoneBasis"]): string =>
    b === "attended" ? "Asistencia" : b === "sold" ? "Ventas" : "—";

  // Progreso de metas, legible en una celda: cada hito con ✅/⬜, su umbral y el
  // premio (cash "S/ N" o "🎁 etiqueta"); en el primer hito no logrado, cuánto
  // falta. Así el organizador ve de un vistazo qué se pagó y qué está por llegar.
  const milestoneProgress = (p: PromoterRow): string => {
    if (p.milestones.length === 0) return "—";
    let pendingShown = false;
    const parts = p.milestones.map((m) => {
      const reward = m.rewardKind === "cash" ? Money.format(m.amountCents ?? 0) : `🎁 ${m.label}`;
      let s = `${m.unlocked ? "✅" : "⬜"} ${m.threshold} → ${reward}`;
      if (!m.unlocked && !pendingShown) {
        s += ` (faltan ${Math.max(0, m.threshold - p.milestoneCount)})`;
        pendingShown = true;
      }
      return s;
    });
    return `Va ${p.milestoneCount} · ${parts.join(" · ")}`;
  };

  const wsP = wb.addWorksheet("Promotores");
  wsP.columns = [
    { header: "Nombre", key: "name", width: 28 },
    { header: "Código de su link", key: "code", width: 18 },
    { header: "Entradas vendidas", key: "ticketsSold", width: 18 },
    { header: "Entradas validadas", key: "ticketsValidated", width: 18 },
    { header: "Recaudado", key: "revenue", width: 14 },
    { header: "Comisión %", key: "commissionPct", width: 12 },
    { header: "Comisión por venta", key: "saleCommission", width: 18 },
    { header: "Base de metas", key: "milestoneBasis", width: 14 },
    { header: "Hitos en efectivo", key: "milestoneCash", width: 16 },
    { header: "A pagar (efectivo)", key: "commission", width: 16 },
    { header: "Premios en especie", key: "perks", width: 28 },
    { header: "Progreso de metas", key: "milestoneProgress", width: 54 },
  ];
  for (const p of promoters) {
    // Dos ejes independientes: % por venta + metas. "A pagar" es solo dinero
    // (comisión por venta + hitos cash); los premios en especie van aparte.
    wsP.addRow({
      name: safeCell(p.name),
      code: safeCell(p.code),
      ticketsSold: p.ticketsSold,
      ticketsValidated: p.ticketsValidated,
      revenue: Money.toSoles(p.revenueCents),
      commissionPct: p.commissionPct / 100,
      saleCommission: Money.toSoles(p.saleCommissionCents),
      milestoneBasis: basisLabel(p.milestoneBasis),
      milestoneCash: Money.toSoles(p.milestoneCashCents),
      commission: Money.toSoles(p.commissionCalculatedCents),
      perks: safeCell(p.unlockedRewards.join(", ")),
      milestoneProgress: safeCell(milestoneProgress(p)),
    });
  }
  wsP.getColumn("revenue").numFmt = SOLES_FMT;
  wsP.getColumn("commissionPct").numFmt = "0%";
  wsP.getColumn("saleCommission").numFmt = SOLES_FMT;
  wsP.getColumn("milestoneCash").numFmt = SOLES_FMT;
  wsP.getColumn("commission").numFmt = SOLES_FMT;
  wsP.getColumn("commission").font = { bold: true };
  wsP.getRow(1).font = { bold: true };

  // ---- Hoja Resumen ----
  const wsS = wb.addWorksheet("Resumen");
  wsS.columns = [
    { header: "Métrica", key: "k", width: 32 },
    { header: "Valor", key: "v", width: 24 },
  ];
  wsS.getRow(1).font = { bold: true };
  wsS.addRow({ k: "Evento", v: safeCell(event.title) });
  wsS.addRow({ k: "Enlace del evento", v: safeCell(event.slug) });
  const startsAtRow = wsS.addRow({ k: "Inicio", v: toLimaDate(event.startsAt) ?? "" });
  startsAtRow.getCell("v").numFmt = "yyyy-mm-dd hh:mm";
  // El nombre textual del lugar (events.venue) es nullable: si el organizador lo
  // eligió por el mapa (Google/Apple) puede quedar solo el link. Caemos a la URL
  // y, si tampoco hay, mostramos "—" para que se lea como "no definido" y no como
  // una celda rota del export.
  wsS.addRow({ k: "Lugar", v: safeCell(event.venue ?? event.venueUrl) || "—" });
  wsS.addRow({ k: "Estado", v: eventStatusLabel(event.status) });
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
  wsS.addRow({ k: "Desglose por entrada" }).font = { bold: true };
  // Por nombre de entrada (mismo label que la hoja Asistentes) + su Tipo
  // (Espacio/Entrada), no por el `name` crudo del ticket_type.
  const headerRow = wsS.addRow({ k: "Nombre de la entrada", v: "Tipo" });
  headerRow.getCell(3).value = "Vendidas";
  headerRow.getCell(4).value = "Capacidad";
  headerRow.getCell(5).value = "Recaudado";
  headerRow.font = { italic: true };
  for (const t of summary.ticketTypes) {
    const row = wsS.addRow({
      k: safeCell(entradaLabel({ name: t.name, boxLabel: t.boxLabel, unitNoun: t.unitNoun })),
      v: kindLabelFor(t.kind === "box"),
    });
    row.getCell(3).value = t.sold;
    row.getCell(4).value = t.capacity;
    row.getCell(5).value = Money.toSoles(t.revenueCents);
    row.getCell(5).numFmt = SOLES_FMT;
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
  const filename = `${event.slug}-reporte.xlsx`;
  return { buffer, filename };
};
