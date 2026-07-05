"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { Money } from "@/lib/_shared/money";
import { useRouter } from "@/i18n/navigation";
import { PhoneField } from "@/components/design/PhoneField";
import { useCreateEvent } from "@/lib/events/hooks/useCreateEvent";
import { useUpdateEvent } from "@/lib/events/hooks/useUpdateEvent";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useSetPromos, type PromoDraft } from "@/lib/events/hooks/usePromos";
import {
  useCreateTicketType,
  useDeleteTicketType,
  useUpdateTicketType,
} from "@/lib/events/hooks/useTicketTypes";
import {
  useCreateOrgPromoter,
  useOrgPromoters,
} from "@/lib/promoters/hooks/useOrgPromoters";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { VenueInput, type VenueValue } from "@/components/ui/VenueInput";
import type { OrgPromoter } from "@/server/promoters/domain/OrgPromoter";
import type {
  Event as EventDomain,
  EventCategory,
  FeeMode,
  PromoKind,
  TicketType,
  TicketTypeKind,
} from "@/server/events/domain/Event";
import { CATEGORIES } from "../../../_home/categories";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";
import { extractFlyerPaletteFromUrl } from "@/lib/_shared/extractFlyerPalette";
import { derivePalette, readableTextColor, type Palette } from "@/lib/_shared/color";
import {
  resolveOrderFee,
  MIN_PAID_TICKET_PRICE_CENTS,
  HIDDEN_FEE_THRESHOLD_CENTS,
} from "@/lib/tickets/serviceFee";

// Morado de marca — default cuando el organizador no elige/sube nada.
const BRAND_ACCENT = "#b87cff";
const BRAND_PALETTE: Palette = derivePalette(BRAND_ACCENT);

// Gradiente de respaldo del flyer (antes de subir foto) — se colorea con la
// paleta elegida, para que cambiarla se vea EN VIVO en la propia página en
// vez de en una maqueta aparte.
function paletteGradient(p: Palette): string {
  return `linear-gradient(135deg, ${p.dark} 0%, ${p.accent} 60%, ${p.mid} 100%)`;
}

// El organizador nunca tocó nada → misma paleta derivada del morado de
// marca con la que arrancó el composer.
function isBrandPalette(p: Palette): boolean {
  return (
    p.dark === BRAND_PALETTE.dark &&
    p.mid === BRAND_PALETTE.mid &&
    p.accent === BRAND_PALETTE.accent
  );
}

// ============================================================
// Tipos
// ============================================================
// El composer del organizador solo crea entradas general/box. Lo "gratis" no es
// un kind aparte: es una entrada a precio 0 (se vende self-service por el link
// del promotor, con el flujo de compra gratis del checkout).
type TicketKind = TicketTypeKind;

type TicketRow = {
  /** id presente sólo si el ticket type ya existe en DB (modo edit). */
  id?: string;
  rowKey: string;
  name: string;
  priceSoles: string;
  capacity: string;
  kind: TicketKind;
  /** Etiqueta humana del box (A, B, VIP-1). Solo aplica si kind === "box". */
  boxLabel: string;
  /** Cómo llama el organizador a la unidad reservable: box, mesa, lounge u otro. */
  unitNoun: string;
  /** ISO 8601. Cierre de ventas de este tipo. */
  saleEndsAt: string;
  /** Descripción visible al comprador: beneficios, restricciones, qué incluye. */
  description: string;
  /** Tramos de preventa: [{ rowKey, priceSoles, endsAt }] ordenados por fecha */
  presaleTiers: Array<{ rowKey: string; priceSoles: string; endsAt: string }>;
  /** Liberar gratis: si está activa, la entrada se suelta a precio 0. */
  isFree: boolean;
  /** ISO 8601. Fin de la liberación. "" = mientras esté activa (la apaga el organizador). */
  freeUntilAt: string;
};

/**
 * Grupo de espacios reservables (boxes/mesas) definido en UN solo card.
 * Se expande a N TicketRows (Box A…F) al guardar. El frontend lo trata como una
 * unidad; el backend recibe N ticket_types (modelo actual).
 */
export type SpaceGroup = {
  rowKey: string;
  name: string;
  priceSoles: string;
  /** Personas por box (aforo de cada instancia). */
  seats: string;
  /** Cuántos boxes genera. */
  count: string;
  /** Etiquetado: letras (A,B,C) o números (1,2,3). */
  scheme: "alpha" | "num";
  /** Override por índice: etiqueta y/o precio propios. */
  overrides: Record<number, { label?: string; price?: string }>;
};

export type ComposerMode = "create" | "edit";

export type EventComposerProps =
  | {
      mode: "create";
      initial?: never;
      onClose?: () => void;
    }
  | {
      mode: "edit";
      initial: {
        slug: string;
        event: EventDomain;
        ticketTypes: TicketType[];
      };
      onClose?: () => void;
    };

// ============================================================
// Constantes / helpers
// ============================================================
const uid = () => Math.random().toString(36).slice(2, 9);
const toCents = (s: string) => Money.toCents(s);

/**
 * Preview de "cuánto le va a llegar cobrado al comprador" mientras el
 * organizador escribe el precio — para que sepa de una que el fee de
 * Pasape se suma (o se esconde adentro) antes de publicar, no como
 * sorpresa después.
 */
const priceFeeHint = (
  priceSoles: string,
  feeMode: FeeMode,
): { text: string; tone: "info" | "warn" | "error" } | null => {
  const priceCents = toCents(priceSoles);
  if (priceCents <= 0) return null; // gratis: sin fee, nada que avisar.
  const fmt = (c: number) => `S/${(c / 100).toLocaleString("es-PE", { minimumFractionDigits: c % 100 === 0 ? 0 : 2 })}`;

  if (priceCents < MIN_PAID_TICKET_PRICE_CENTS) {
    return { text: `El precio mínimo de venta es ${fmt(MIN_PAID_TICKET_PRICE_CENTS)}.`, tone: "error" };
  }
  const { chargedToBuyerCents, showFeeLine } = resolveOrderFee(
    priceCents,
    feeMode,
    [{ unitPriceCents: priceCents, chargedQty: 1 }],
  );
  if (priceCents < HIDDEN_FEE_THRESHOLD_CENTS) {
    return {
      text: `Tú recibes tus ${fmt(priceCents)} completos. El comprador paga ${fmt(priceCents + chargedToBuyerCents)} en total, pero no le mostramos la comisión aparte por ser un precio bajo (aplica igual sin importar el tipo de comisión que elijas, "Aparte" o "Incluida").`,
      tone: "warn",
    };
  }
  if (!showFeeLine) {
    return {
      text: `El comprador paga ${fmt(priceCents)} en total (ya incluye la comisión que tú absorbes).`,
      tone: "info",
    };
  }
  return {
    text: `El comprador paga ${fmt(priceCents + chargedToBuyerCents)} (${fmt(priceCents)} + ${fmt(chargedToBuyerCents)} de comisión, aparte).`,
    tone: "info",
  };
};

function PriceFeeHint({ priceSoles, feeMode }: { priceSoles: string; feeMode: FeeMode }) {
  const hint = priceFeeHint(priceSoles, feeMode);
  if (!hint) return null;
  const color =
    hint.tone === "error" ? "text-rose-300" : hint.tone === "warn" ? "text-amber-300" : "text-cart-ink-3";
  return <p className={`mt-1.5 text-[11px] ${color}`}>{hint.text}</p>;
}
const fromCents = (n: number) => Money.toSoles(n).toString();

/** Convierte presaleTiers del form al payload para la API. */
const presaleTiersPayload = (t: TicketRow) => ({
  presaleTiers: t.presaleTiers
    .filter(tier => tier.priceSoles.trim() && tier.endsAt)
    .map(tier => ({ priceCents: toCents(tier.priceSoles), endsAt: tier.endsAt })),
});

/** Liberación gratis al payload. Si no está liberada, la fecha se ignora. */
const freeReleasePayload = (t: TicketRow) => ({
  isFree: t.isFree,
  freeUntilAt: t.isFree && t.freeUntilAt ? t.freeUntilAt : null,
});

// ── Helpers de grupos de espacios (boxes/mesas) ──────────────────────────────
const spaceCount = (g: SpaceGroup) => Math.max(0, Math.min(60, Number(g.count) || 0));
const spaceSeats = (g: SpaceGroup) => Math.max(1, Number(g.seats) || 1);
const spaceBoxLabel = (g: SpaceGroup, i: number) => {
  const auto = g.scheme === "alpha" ? String.fromCharCode(65 + (i % 26)) : String(i + 1);
  return g.overrides[i]?.label?.trim() || `${g.name.trim() || "Box"} ${auto}`;
};
const spaceBoxPriceSoles = (g: SpaceGroup, i: number) => {
  const ov = g.overrides[i]?.price;
  return ov != null && ov !== "" ? Number(ov) || 0 : Number(g.priceSoles || "0");
};
/** Expande un grupo a payloads de ticket_type (kind=box), uno por instancia. */
const expandSpaceGroup = (g: SpaceGroup) =>
  Array.from({ length: spaceCount(g) }, (_, i) => {
    const label = spaceBoxLabel(g, i);
    return {
      name: label,
      kind: "box" as const,
      priceCents: Money.toCents(spaceBoxPriceSoles(g, i)),
      capacity: spaceSeats(g),
      boxLabel: label,
      unitNoun: (g.name.trim() || "Box").toLowerCase(),
      saleEndsAt: null,
      description: null,
      presaleTiers: [],
      isFree: false,
      freeUntilAt: null,
    };
  });
const newSpaceGroup = (): SpaceGroup => ({
  rowKey: uid(),
  name: "Box",
  priceSoles: "200",
  seats: "8",
  count: "6",
  scheme: "alpha",
  overrides: {},
});

const TICKET_KIND_META: Record<TicketKind, { label: string; tint: string }> = {
  general: { label: "General", tint: "rgba(184,124,255,0.55)" },
  box: { label: "Box", tint: "rgba(34,209,127,0.55)" },
};

const EVENT_ASSETS_BUCKET = "event-assets";

const slugifyForPath = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "event";

const extFromFile = (file: File): string => {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()! : "";
  if (fromName) return fromName.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const m = /\/([a-z0-9]+)/i.exec(file.type);
  return (m?.[1] ?? "bin").toLowerCase();
};


async function uploadEventAsset(
  file: File,
  opts: { slugHint: string; kind: "cover" | "layout" },
): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const folder = slugifyForPath(opts.slugHint);
  const path = `events/${folder}/${opts.kind}-${Date.now()}.${extFromFile(file)}`;
  const { error } = await supabase.storage
    .from(EVENT_ASSETS_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw new Error(`upload_failed: ${error.message}`);
  const { data } = supabase.storage.from(EVENT_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const truncate = (s: string, n: number): string =>
  s.length > n ? s.slice(0, n - 1) + "…" : s;

// Convierte ISO + timezone a {date: YYYY-MM-DD, time: HH:mm} en el tz del evento.
function isoToDateTime(iso: string, tz: string): { date: string; time: string } {
  const d = new Date(iso);
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { date: dateFmt.format(d), time: timeFmt.format(d) };
}

// ============================================================
// Composer principal
// ============================================================
export function EventComposer(props: EventComposerProps) {
  const { mode } = props;
  const router = useRouter();
  const create = useCreateEvent();
  const isEdit = mode === "edit";

  // En edit, slug fijo; en create no aplica.
  const editSlug = isEdit ? props.initial.slug : "";
  const update = useUpdateEvent(editSlug);
  const createTT = useCreateTicketType(editSlug);
  const updateTT = useUpdateTicketType(editSlug);
  const deleteTT = useDeleteTicketType(editSlug);
  const setPromosMut = useSetPromos(editSlug);
  // Promos actuales (solo en edit; en create useEvent no fetchea por slug "").
  const eventQuery = useEvent(editSlug);
  const [promos, setPromos] = useState<PromoDraft[]>([]);
  const promosSeeded = useRef(false);
  useEffect(() => {
    if (!promosSeeded.current && eventQuery.data?.promos) {
      setPromos(
        eventQuery.data.promos.map((p) => ({
          ticketTypeId: p.ticketTypeId,
          kind: p.kind,
          endsAt: p.endsAt,
        })),
      );
      promosSeeded.current = true;
    }
  }, [eventQuery.data]);

  // ---------- refs para focus al campo faltante ----------
  const titleRef = useRef<HTMLInputElement>(null);
  const dateAnchorRef = useRef<HTMLDivElement>(null);
  const timeAnchorRef = useRef<HTMLDivElement>(null);

  // ---------- estado inicial ----------
  const seedFromEdit = useMemo(() => {
    if (!isEdit) return null;
    const ev = props.initial.event;
    const { date, time } = isoToDateTime(ev.startsAt, ev.timezone);
    const venueValue: VenueValue = {
      name: ev.venue ?? "",
      lat: ev.venueLat,
      lng: ev.venueLng,
      url: ev.venueUrl,
      source: (ev.venueSource ?? "manual") as VenueValue["source"],
    };
    const rows: TicketRow[] = props.initial.ticketTypes
      .map((tt) => ({
      id: tt.id,
      rowKey: tt.id,
      name: tt.name,
      kind: tt.kind as TicketKind,
      priceSoles: fromCents(tt.priceCents),
      // El form usa un solo campo de cupo; el dominio lo separa por kind.
      capacity: String(tt.kind === "box" ? tt.seats : tt.stock),
      boxLabel: tt.boxLabel ?? "",
      unitNoun: tt.unitNoun ?? "",
      saleEndsAt: tt.saleEndsAt ?? "",
      description: tt.description ?? "",
      presaleTiers: tt.presaleTiers.map((t) => ({
        rowKey: t.id,
        priceSoles: fromCents(t.priceCents),
        endsAt: t.endsAt,
      })),
      isFree: tt.isFree,
      freeUntilAt: tt.freeUntilAt ?? "",
    }));
    const durationHoursFromEdit = ev.endsAt
      ? Math.round((new Date(ev.endsAt).getTime() - new Date(ev.startsAt).getTime()) / 3_600_000)
      : 0;
    return {
      title: ev.title,
      description: ev.description ?? "",
      category: ev.category ?? null,
      feeMode: ev.feeMode,
      date,
      time,
      durationHours: durationHoursFromEdit > 0 ? String(durationHoursFromEdit) : "",
      venue: venueValue,
      coverUrl: ev.coverUrl,
      palette:
        ev.paletteDark && ev.paletteMid && ev.paletteAccent
          ? { dark: ev.paletteDark, mid: ev.paletteMid, accent: ev.paletteAccent }
          : null,
      layoutUrl: ev.venueLayoutUrl,
      tickets:
        rows.length > 0
          ? rows
          : [
              {
                rowKey: uid(),
                name: "General",
                priceSoles: "30",
                capacity: "200",
                kind: "general" as TicketKind,
                boxLabel: "",
                unitNoun: "",
                saleEndsAt: "",
                description: "",
                presaleTiers: [],
                isFree: false,
                freeUntilAt: "",
              },
            ],
      publishNow: ev.status === "published",
    };
    // initial is stable per mount in edit mode (we re-mount per slug).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const [title, setTitle] = useState(seedFromEdit?.title ?? "");
  const [description, setDescription] = useState(seedFromEdit?.description ?? "");
  // Preseleccionada en "fiestas" (categoría dominante del ICP nightlife) y requerida:
  // los chips funcionan como radio, nunca queda en null → el evento siempre es filtrable.
  const [category, setCategory] = useState<EventCategory>(seedFromEdit?.category ?? "fiestas");
  // Quién absorbe la comisión de Pasape: el comprador la paga aparte
  // (default) o el organizador la incluye en el precio que puso.
  const [feeMode, setFeeMode] = useState<FeeMode>(seedFromEdit?.feeMode ?? "buyer_pays_extra");
  const [date, setDate] = useState(seedFromEdit?.date ?? "");
  const [time, setTime] = useState(seedFromEdit?.time ?? "");
  const [durationHours, setDurationHours] = useState(seedFromEdit?.durationHours ?? "");
  const [venue, setVenue] = useState<VenueValue>(
    seedFromEdit?.venue ?? {
      name: "",
      lat: null,
      lng: null,
      url: null,
      source: "manual",
    },
  );
  const [tickets, setTickets] = useState<TicketRow[]>(
    seedFromEdit?.tickets ?? [
      {
        rowKey: uid(),
        name: "General",
        priceSoles: "30",
        capacity: "200",
        kind: "general",
        boxLabel: "",
        unitNoun: "",
        saleEndsAt: "",
        description: "",
        presaleTiers: [],
        isFree: false,
        freeUntilAt: "",
      },
    ],
  );
  // Grupos de espacios (boxes/mesas) creados en este composer. Cada grupo es UN
  // card que se expande a N boxes al guardar. En edit, los boxes ya existentes
  // siguen como TicketRows; los grupos nuevos se agregan como ticket_types.
  const [spaceGroups, setSpaceGroups] = useState<SpaceGroup[]>([]);
  const [selectedPromoterIds, setSelectedPromoterIds] = useState<Set<string>>(
    new Set(),
  );
  const orgPromoters = useOrgPromoters();
  const createPromoter = useCreateOrgPromoter();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    seedFromEdit?.coverUrl ?? null,
  );
  // Paleta del evento (fondo/medio/acento): se extrae del flyer al subirlo
  // (los 3 combinan porque salen de la imagen real, no se derivan
  // matemáticamente uno de otro) y cada tono es editable por separado.
  // Default = derivado del morado de marca hasta que suba un flyer.
  const [palette, setPalette] = useState<Palette>(
    seedFromEdit?.palette ?? BRAND_PALETTE,
  );
  const [extractingPalette, setExtractingPalette] = useState(false);
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [layoutPreview, setLayoutPreview] = useState<string | null>(
    seedFromEdit?.layoutUrl ?? null,
  );
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishNow, setPublishNow] = useState(seedFromEdit?.publishNow ?? true);
  const [openSheet, setOpenSheet] = useState<
    null | "tickets" | "promoters" | "description" | "promos"
  >(null);
  const [highlight, setHighlight] = useState<
    null | "nombre" | "fecha" | "hora" | "entradas"
  >(null);

  // En edit, ids originales de ticket types para calcular diff al guardar.
  const originalTicketIds = useMemo(
    () =>
      isEdit
        ? new Set(props.initial.ticketTypes.map((tt) => tt.id))
        : new Set<string>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit],
  );
  const originalTicketsById = useMemo(
    () =>
      isEdit
        ? new Map(props.initial.ticketTypes.map((tt) => [tt.id, tt]))
        : new Map<string, TicketType>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit],
  );

  // ---------- derivados ----------
  // Boxes provenientes de grupos (se expanden al guardar).
  const spaceBoxesCount = useMemo(
    () => spaceGroups.reduce((a, g) => a + spaceCount(g), 0),
    [spaceGroups],
  );
  const totalCapacity = useMemo(
    () =>
      tickets.reduce((a, t) => a + Number(t.capacity || 0), 0) +
      spaceGroups.reduce((a, g) => a + spaceCount(g) * spaceSeats(g), 0),
    [tickets, spaceGroups],
  );
  const totalMax = useMemo(
    () =>
      tickets.reduce(
        (a, t) => a + Number(t.capacity || 0) * Number(t.priceSoles || 0),
        0,
      ) +
      spaceGroups.reduce(
        (a, g) =>
          a +
          Array.from({ length: spaceCount(g) }).reduce<number>(
            (s, _, i) => s + spaceBoxPriceSoles(g, i),
            0,
          ),
        0,
      ),
    [tickets, spaceGroups],
  );

  const formattedDateLong = useMemo(() => {
    if (!date) return null;
    try {
      const d = new Date(date + "T00:00:00");
      return d
        .toLocaleDateString("es-PE", {
          weekday: "long",
          day: "2-digit",
          month: "long",
        })
        .replace(/^\w/, (c) => c.toUpperCase());
    } catch {
      return date;
    }
  }, [date]);

  const validTickets = tickets.filter(
    (t) =>
      t.name.trim() &&
      Number(t.capacity) > 0 &&
      (t.kind !== "box" || t.boxLabel.trim().length > 0),
  );

  const hasValidSpace = spaceGroups.some((g) => spaceCount(g) >= 1);

  // Nombres de entrada repetidos (sin distinción de mayúsculas ni espacios):
  // confunden al comprador (no sabe cuál elegir). Se bloquea publicar.
  const dupTicketKeys = useMemo(() => duplicateTicketRowKeys(tickets), [tickets]);

  const missingFields = useMemo(() => {
    const m: string[] = [];
    if (!title.trim()) m.push("nombre");
    if (!date) m.push("fecha");
    if (!time) m.push("hora");
    if (validTickets.length === 0 && !hasValidSpace) m.push("entradas");
    return m;
  }, [title, date, time, validTickets.length, hasValidSpace]);

  const ready = missingFields.length === 0 && dupTicketKeys.size === 0;

  // ---------- focus al campo faltante ----------
  const focusFirstMissing = () => {
    const first = missingFields[0];
    // Sin campos faltantes pero con nombres repetidos → abre el editor de
    // entradas para que vea el error marcado en rojo.
    if (!first) {
      if (dupTicketKeys.size > 0) setOpenSheet("tickets");
      return;
    }
    const id = first as "nombre" | "fecha" | "hora" | "entradas";
    setHighlight(id);
    if (id === "nombre") {
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => titleRef.current?.focus(), 280);
      return;
    }
    if (id === "fecha") {
      const el = dateAnchorRef.current;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => el?.querySelector<HTMLButtonElement>("button")?.click(), 320);
      return;
    }
    if (id === "hora") {
      const el = timeAnchorRef.current;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => el?.querySelector<HTMLButtonElement>("button")?.click(), 320);
      return;
    }
    if (id === "entradas") {
      setOpenSheet("tickets");
    }
  };

  // Quita el highlight cuando el usuario llena el campo en cuestión.
  useEffect(() => {
    if (!highlight) return;
    if (highlight === "nombre" && title.trim()) setHighlight(null);
    else if (highlight === "fecha" && date) setHighlight(null);
    else if (highlight === "hora" && time) setHighlight(null);
    else if (highlight === "entradas" && validTickets.length > 0)
      setHighlight(null);
  }, [highlight, title, date, time, validTickets.length]);

  // ---------- submit (create) ----------
  const handleCreate = async () => {
    setSubmitError(null);
    if (!ready) {
      focusFirstMissing();
      return;
    }
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const ticketTypes = [
        ...validTickets.map((t) => ({
          name: t.name,
          kind: t.kind,
          priceCents: toCents(t.priceSoles),
          capacity: Number(t.capacity),
          boxLabel: t.kind === "box" ? t.boxLabel.trim() : null,
          unitNoun: t.kind === "box" ? t.unitNoun.trim() || null : null,
          saleEndsAt: t.saleEndsAt || null,
          description: t.description.trim() || null,
          ...presaleTiersPayload(t),
          ...freeReleasePayload(t),
        })),
        // Expandir cada grupo de espacios a N boxes (Box A…F).
        ...spaceGroups.flatMap(expandSpaceGroup),
      ];

      let venueLayoutUrl: string | null = null;
      let coverUrl: string | null = null;
      if (layoutFile || coverFile) {
        setUploadingAssets(true);
        try {
          if (layoutFile) {
            venueLayoutUrl = await uploadEventAsset(layoutFile, {
              slugHint: title,
              kind: "layout",
            });
          }
          if (coverFile) {
            try {
              coverUrl = await uploadEventAsset(coverFile, { slugHint: title, kind: "cover" });
            } catch {
              // si falla el cover no bloqueamos
            }
          }
        } finally {
          setUploadingAssets(false);
        }
      }

      const dh = Number(durationHours);
      const endsAt =
        dh > 0 && date && time
          ? new Date(new Date(`${date}T${time}:00`).getTime() + dh * 3_600_000).toISOString()
          : null;
      const ev = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        category,
        venue: venue.name.trim() || null,
        venueLat: venue.lat,
        venueLng: venue.lng,
        venueUrl: venue.url,
        venueSource: venue.source,
        venueLayoutUrl,
        coverUrl,
        // BRAND_PALETTE sin tocar = "no personalizó nada" → null en los 3,
        // para que la página del evento no aplique ningún tinte (se ve como
        // el Pasape normal en vez de un wash de fondo).
        ...(isBrandPalette(palette)
          ? { paletteDark: null, paletteMid: null, paletteAccent: null }
          : { paletteDark: palette.dark, paletteMid: palette.mid, paletteAccent: palette.accent }),
        startsAt,
        endsAt,
        timezone: "America/Lima",
        ticketTypes,
        transfersEnabled: true,
        transferRequiresKyc: false,
        feeMode,
      });
      if (selectedPromoterIds.size > 0 && ev.slug) {
        try {
          await fetch(`/api/events/${ev.slug}/promoters`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              orgPromoterIds: Array.from(selectedPromoterIds),
            }),
          });
        } catch {
          // si falla la asignación, lo puede ajustar luego en /team
        }
      }

      let finalStatus: "draft" | "published" = "draft";
      if (publishNow && ev.slug) {
        try {
          const res = await fetch(`/api/events/${ev.slug}/publish`, {
            method: "POST",
          });
          if (res.ok) finalStatus = "published";
        } catch {
          // ignora — queda en draft
        }
      }
      router.push(
        `/org/events/new/success?slug=${ev.slug ?? ""}&status=${finalStatus}` as never,
      );
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  // ---------- submit (edit) ----------
  const handleEdit = async () => {
    if (!isEdit) return;
    setSubmitError(null);
    if (!ready) {
      focusFirstMissing();
      return;
    }
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const ev = props.initial.event;

      // Subir assets nuevos primero (si los hay) para tener URLs.
      let nextCoverUrl: string | null | undefined;
      let nextLayoutUrl: string | null | undefined;
      if (coverFile || layoutFile) {
        setUploadingAssets(true);
        try {
          if (coverFile) {
            nextCoverUrl = await uploadEventAsset(coverFile, {
              slugHint: title,
              kind: "cover",
            });
          }
          if (layoutFile) {
            nextLayoutUrl = await uploadEventAsset(layoutFile, {
              slugHint: title,
              kind: "layout",
            });
          }
        } finally {
          setUploadingAssets(false);
        }
      }

      // Calcular diff de campos contra el evento original.
      const patch: Record<string, unknown> = {};
      const trimTitle = title.trim();
      if (trimTitle !== ev.title) patch.title = trimTitle;
      const nextDesc = description.trim() || null;
      if (nextDesc !== ev.description) patch.description = nextDesc;
      if (category !== (ev.category ?? null)) patch.category = category;
      if (feeMode !== ev.feeMode) patch.feeMode = feeMode;
      const nextVenueName = venue.name.trim() || null;
      if (nextVenueName !== ev.venue) patch.venue = nextVenueName;
      if (venue.lat !== ev.venueLat) patch.venueLat = venue.lat;
      if (venue.lng !== ev.venueLng) patch.venueLng = venue.lng;
      if (venue.url !== ev.venueUrl) patch.venueUrl = venue.url;
      if (venue.source !== ev.venueSource) patch.venueSource = venue.source;
      if (startsAt !== ev.startsAt) patch.startsAt = startsAt;
      const dhEdit = Number(durationHours);
      const nextEndsAt =
        dhEdit > 0 && date && time
          ? new Date(new Date(`${date}T${time}:00`).getTime() + dhEdit * 3_600_000).toISOString()
          : null;
      if (nextEndsAt !== ev.endsAt) patch.endsAt = nextEndsAt;
      if (nextCoverUrl !== undefined) patch.coverUrl = nextCoverUrl;
      const nextDark = isBrandPalette(palette) ? null : palette.dark;
      const nextMid = isBrandPalette(palette) ? null : palette.mid;
      const nextAccent = isBrandPalette(palette) ? null : palette.accent;
      if (nextDark !== ev.paletteDark) patch.paletteDark = nextDark;
      if (nextMid !== ev.paletteMid) patch.paletteMid = nextMid;
      if (nextAccent !== ev.paletteAccent) patch.paletteAccent = nextAccent;
      if (nextLayoutUrl !== undefined) patch.venueLayoutUrl = nextLayoutUrl;

      const desiredStatus: EventDomain["status"] = publishNow
        ? "published"
        : "draft";
      if (desiredStatus !== ev.status && (ev.status === "draft" || ev.status === "published")) {
        patch.status = desiredStatus;
      }

      if (Object.keys(patch).length > 0) {
        await update.mutateAsync(patch);
      }

      // Diff de ticket types: crear nuevos, actualizar cambiados, borrar removidos.
      const currentIds = new Set(
        tickets.filter((t) => t.id).map((t) => t.id as string),
      );

      // Crear nuevos. Apenas el backend confirma, escribimos el id devuelto en
      // la fila local para que un reintento NO los vuelva a crear. Sin esto, si
      // el guardado fallaba más abajo (p. ej. al borrar un box con ventas →
      // has_sold_tickets) y el organizador reintentaba, estas filas seguían sin
      // id y se recreaban: por eso los boxes se multiplicaban en cada intento.
      const toCreate = validTickets.filter((t) => !t.id);
      for (const t of toCreate) {
        const created = await createTT.mutateAsync({
          name: t.name,
          kind: t.kind,
          priceCents: toCents(t.priceSoles),
          capacity: Number(t.capacity),
          boxLabel: t.kind === "box" ? t.boxLabel.trim() : null,
          unitNoun: t.kind === "box" ? t.unitNoun.trim() || null : null,
          saleEndsAt: t.saleEndsAt || null,
          description: t.description.trim() || null,
          ...presaleTiersPayload(t),
          ...freeReleasePayload(t),
        });
        setTickets((prev) =>
          prev.map((row) => (row.rowKey === t.rowKey ? { ...row, id: created.id } : row)),
        );
      }

      // Expandir cada grupo de espacios nuevo a N boxes. Se crean UNA sola vez:
      // al terminar el grupo lo quitamos de spaceGroups y sus boxes ya creados
      // pasan a ser filas con id — un reintento no los recrea.
      for (const g of spaceGroups) {
        const createdRows: TicketRow[] = [];
        for (const box of expandSpaceGroup(g)) {
          const created = await createTT.mutateAsync(box);
          createdRows.push({
            id: created.id,
            rowKey: created.id,
            name: box.name,
            kind: "box",
            priceSoles: fromCents(box.priceCents),
            capacity: String(box.capacity),
            boxLabel: box.boxLabel ?? "",
            unitNoun: box.unitNoun ?? "",
            saleEndsAt: "",
            description: "",
            presaleTiers: [],
            isFree: false,
            freeUntilAt: "",
          });
        }
        setTickets((prev) => [...prev, ...createdRows]);
        setSpaceGroups((prev) => prev.filter((x) => x.rowKey !== g.rowKey));
      }

      // Actualizar cambiados
      const toUpdate = validTickets.filter((t) => t.id);
      for (const t of toUpdate) {
        const orig = originalTicketsById.get(t.id!);
        if (!orig) continue;
        const ttPatch: Record<string, unknown> = {};
        if (t.name !== orig.name) ttPatch.name = t.name;
        const nextPrice = toCents(t.priceSoles);
        if (nextPrice !== orig.priceCents) ttPatch.priceCents = nextPrice;
        const nextCap = Number(t.capacity);
        const origCap = orig.kind === "box" ? orig.seats : orig.stock;
        if (nextCap !== origCap) ttPatch.capacity = nextCap;
        const nextLabel = t.kind === "box" ? t.boxLabel.trim() : null;
        if (nextLabel !== orig.boxLabel) ttPatch.boxLabel = nextLabel;
        const nextNoun =
          t.kind === "box" ? t.unitNoun.trim() || null : null;
        if (nextNoun !== orig.unitNoun) ttPatch.unitNoun = nextNoun;
        const nextSaleEndsAt = t.saleEndsAt || null;
        if (nextSaleEndsAt !== orig.saleEndsAt) ttPatch.saleEndsAt = nextSaleEndsAt;
        const nextDesc = t.description.trim() || null;
        if (nextDesc !== orig.description) ttPatch.description = nextDesc;
        // Tiers: siempre enviamos para que el backend reemplace
        const newTiers = presaleTiersPayload(t).presaleTiers;
        const origTiersKey = orig.presaleTiers.map(x => `${x.priceCents}:${x.endsAt}`).join("|");
        const newTiersKey = newTiers.map(x => `${x.priceCents}:${x.endsAt}`).join("|");
        if (newTiersKey !== origTiersKey) ttPatch.presaleTiers = newTiers;
        // Liberación gratis: toggle y/o fecha de fin.
        const nextFree = freeReleasePayload(t);
        if (nextFree.isFree !== orig.isFree) ttPatch.isFree = nextFree.isFree;
        if (nextFree.freeUntilAt !== (orig.freeUntilAt ?? null)) ttPatch.freeUntilAt = nextFree.freeUntilAt;
        if (Object.keys(ttPatch).length > 0) {
          await updateTT.mutateAsync({ id: t.id!, input: ttPatch });
        }
      }

      // Borrar los que estaban antes y ya no están. Un box con ventas NO se
      // puede borrar (has_sold_tickets): lo saltamos y avisamos, en vez de
      // abortar TODO el guardado — abortar dejaba los boxes recién creados sin
      // reflejar y disparaba el reintento que los multiplicaba.
      const soldBlocked: string[] = [];
      for (const origId of originalTicketIds) {
        if (!currentIds.has(origId)) {
          try {
            await deleteTT.mutateAsync(origId);
          } catch (e) {
            if ((e as Error).message === "has_sold_tickets") {
              const orig = originalTicketsById.get(origId);
              soldBlocked.push(orig?.boxLabel || orig?.name || "una entrada");
            } else {
              throw e;
            }
          }
        }
      }

      // Guardar promos (reemplazo total). Solo las que apuntan a una entrada real.
      const validTicketIds = new Set(validTickets.map((t) => t.id).filter(Boolean));
      await setPromosMut.mutateAsync(
        promos.filter((p) => validTicketIds.has(p.ticketTypeId)),
      );

      // Si algún box con ventas no se pudo quitar, guardamos el resto pero
      // dejamos el editor abierto con el aviso (no cerramos en silencio).
      if (soldBlocked.length > 0) {
        setSubmitError(
          `Guardamos tus cambios, pero no pudimos quitar ${soldBlocked.join(", ")} porque ya tiene ventas.`,
        );
        return;
      }

      props.onClose?.();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  const handlePublish = isEdit ? handleEdit : handleCreate;

  // Reutilizable: dispara tanto desde el <input> (click) como desde el drop
  // — la imagen se queda local (preview) hasta crear/actualizar. La paleta
  // ya NO se extrae sola: el organizador decide con el botón "Color de la
  // portada" (evita que un flyer con colores raros arruine el tono elegido).
  const handleCoverFile = (file: File) => {
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const extractPaletteFromCover = () => {
    // Funciona con la portada recién elegida (blob: URL) y con la que ya
    // estaba guardada al entrar a editar (URL del storage) — ambas viven en
    // `coverPreview`, no hace falta haber tocado el <input> en esta sesión.
    if (!coverPreview) return;
    setExtractingPalette(true);
    extractFlyerPaletteFromUrl(coverPreview)
      .then((extracted) => {
        if (extracted) setPalette(extracted);
      })
      .finally(() => setExtractingPalette(false));
  };

  const resetPaletteToDefault = () => setPalette(BRAND_PALETTE);

  const onRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
    // La paleta es independiente de la portada — quitar la foto no debe
    // tocar los colores que el organizador ya eligió (con "Volver a
    // original" puede resetearla a mano si quiere).
  };

  const onPickLayout = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLayoutFile(file);
    setLayoutPreview(URL.createObjectURL(file));
  };

  // CTA inteligente. `uploadingAssets` entra acá: mientras se suben las
  // imágenes el CTA ya muestra "Subiendo imágenes…", pero si no deshabilita el
  // botón se puede volver a clickear y disparar otro guardado/subida encima.
  const submitting =
    uploadingAssets ||
    create.isPending ||
    update.isPending ||
    createTT.isPending ||
    updateTT.isPending ||
    deleteTT.isPending;

  const ctaLabel = uploadingAssets
    ? "Subiendo imágenes…"
    : submitting
      ? isEdit
        ? "Guardando…"
        : publishNow
          ? "Publicando…"
          : "Guardando…"
      : !ready
        ? `Falta ${missingFields[0]}`
        : isEdit
          ? "Actualizar evento"
          : publishNow
            ? "Publicar en vivo"
            : "Guardar borrador";

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="mx-auto w-full max-w-[1180px] pb-32 lg:pb-12">
      {/* Header (solo modo create — en edit el sheet ya tiene su propio header) */}
      {!isEdit && (
        <div className="mb-6 flex items-center justify-between gap-3 lg:mb-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                props.onClose
                  ? props.onClose()
                  : router.push("/org/events" as never)
              }
              aria-label="Cancelar"
              className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <h1 className="font-sans text-[22px] font-semibold leading-tight tracking-[-0.02em] lg:text-[26px]">
              Nuevo evento
            </h1>
          </div>
          <div className="hidden lg:block">
            <PublishToggle value={publishNow} onChange={setPublishNow} />
          </div>
        </div>
      )}

      {/* Body */}
      <div
        className={
          isEdit
            ? "flex flex-col gap-3.5"
            : "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-10"
        }
      >
        {/* Flyer card */}
        {!isEdit && (
          <div className="lg:sticky lg:top-6 lg:self-start">
            <FlyerCard
              title={title}
              dateLong={formattedDateLong}
              time={time}
              venueName={venue.name}
              coverPreview={coverPreview}
              palette={palette}
              onCoverFile={handleCoverFile}
              onRemoveCover={onRemoveCover}
            />
            <PaletteEditor
              palette={palette}
              loading={extractingPalette}
              onChange={setPalette}
              canExtractFromCover={!!coverPreview}
              onExtractFromCover={extractPaletteFromCover}
              onResetToDefault={resetPaletteToDefault}
            />
            <div className="mt-3 hidden flex-col gap-2 text-[12px] text-cart-ink-3 lg:flex">
              <div className="flex items-center justify-between rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 place-items-center rounded-lg bg-cart-bg-elev-2">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="2" y="3" width="10" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M2 6l4 3 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  Distribución del local
                </div>
                <UploadChip
                  label={layoutPreview ? "Cambiar" : "Subir"}
                  onChange={onPickLayout}
                  accept="image/*"
                />
              </div>
              {layoutPreview && (
                <div className="relative overflow-hidden rounded-2xl border border-cart-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={layoutPreview} alt="" className="aspect-16/10 w-full object-cover" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inspector (form) */}
        <div className="flex flex-col gap-3.5">
          {/* Toggle live/draft arriba en edit, debajo de todo en create-mobile */}
          {isEdit && (
            <PublishToggle value={publishNow} onChange={setPublishNow} />
          )}

          {/* Cover en edit */}
          {isEdit && (
            <CoverEditor
              coverPreview={coverPreview}
              palette={palette}
              onCoverFile={handleCoverFile}
              onRemoveCover={onRemoveCover}
            />
          )}
          {isEdit && (
            <PaletteEditor
              palette={palette}
              loading={extractingPalette}
              onChange={setPalette}
              canExtractFromCover={!!coverPreview}
              onExtractFromCover={extractPaletteFromCover}
              onResetToDefault={resetPaletteToDefault}
            />
          )}

          {/* Nombre */}
          <TitleField
            value={title}
            onChange={setTitle}
            inputRef={titleRef}
            highlight={highlight === "nombre"}
          />

          {/* Categoría — junto al nombre: define "qué es" el evento. Requerida (default fiestas). */}
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                Categoría
              </span>
              {CATEGORIES.map(({ id, label, color }) => {
                const active = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCategory(id)}
                    className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                      active ? "" : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-white"
                    }`}
                    style={
                      active
                        ? { borderColor: color, background: `${color}1f`, color: "#fff" }
                        : undefined
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descripción — junto a nombre/categoría: completa el "de qué va" el evento */}
          <CardButton
            icon={<IconText />}
            label="Descripción"
            hint={description ? truncate(description, 80) : "Opcional — vibras, lineup, dress code"}
            onClick={() => setOpenSheet("description")}
            active={!!description.trim()}
          />

          {/* Fecha + hora */}
          <div
            className={
              "rounded-2xl border bg-cart-bg-elev px-4 py-3 transition " +
              (highlight === "fecha" || highlight === "hora"
                ? "border-amber-400/70 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]"
                : "border-cart-line")
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-3">
              <div ref={dateAnchorRef}>
                <FieldShell icon={<IconCalendar />} label="Fecha">
                  <DatePicker value={date} onChange={setDate} placeholder="Elegir día" />
                </FieldShell>
              </div>
              <div ref={timeAnchorRef}>
                <FieldShell icon={<IconClock />} label="Hora">
                  <TimePicker value={time} onChange={setTime} placeholder="Elegir hora" />
                </FieldShell>
              </div>
            </div>
          </div>

          {/* Duración del evento (opcional) */}
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                Duración
              </span>
              {["2", "4", "6", "8", "12", "24"].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDurationHours(durationHours === h ? "" : h)}
                  className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                    durationHours === h
                      ? "border-cart-accent bg-cart-accent/15 text-white"
                      : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-white"
                  }`}
                >
                  {h}h
                </button>
              ))}
              <label className={`flex items-center gap-0.5 rounded-full border px-3 py-1 transition-colors ${
                durationHours && !["2","4","6","8","12","24"].includes(durationHours)
                  ? "border-cart-accent bg-cart-accent/15"
                  : "border-cart-line"
              }`}>
                <input
                  inputMode="numeric"
                  value={["2","4","6","8","12","24"].includes(durationHours) ? "" : durationHours}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setDurationHours(v === "0" ? "" : v);
                  }}
                  placeholder="otro"
                  maxLength={3}
                  className="w-9 bg-transparent text-[11.5px] font-medium text-white outline-none placeholder:text-cart-ink-4"
                />
                {durationHours && !["2","4","6","8","12","24"].includes(durationHours) && (
                  <span className="text-[11.5px] text-cart-ink-3">h</span>
                )}
              </label>
              {durationHours && Number(durationHours) > 0 && date && time && (() => {
                const endsAtPreview = new Date(
                  new Date(`${date}T${time}:00`).getTime() + Number(durationHours) * 3_600_000,
                );
                const TZ = "America/Lima";
                const endLabel = new Intl.DateTimeFormat("es-PE", {
                  day: "numeric", month: "short",
                  hour: "2-digit", minute: "2-digit", hour12: true,
                  timeZone: TZ,
                }).format(endsAtPreview);
                // Comparar en hora local, no UTC, para evitar desfase de zona horaria
                const endDateLocal = new Intl.DateTimeFormat("en-CA", {
                  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
                }).format(endsAtPreview);
                const endHour = Number(new Intl.DateTimeFormat("en-GB", {
                  timeZone: TZ, hour: "2-digit", hour12: false,
                }).format(endsAtPreview));
                const isNextDay = endDateLocal !== date;
                const isMadrugada = isNextDay && endHour >= 0 && endHour < 5;
                return (
                  <span className="text-[11px] text-cart-ink-3">
                    → <span className="font-medium text-white/70">{endLabel}</span>
                    {isMadrugada && (
                      <span className="ml-1 text-violet-400">madrugada</span>
                    )}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Venue */}
          <Card>
            <FieldShell icon={<IconPin />} label="Lugar">
              <VenueInput
                value={venue}
                onChange={setVenue}
                placeholder="Pega Google Maps o escribe el venue"
              />
            </FieldShell>
          </Card>

          {/* Comisión de Pasape: quién la paga — el comprador aparte (default) o
              el organizador la incluye en el precio que puso. Justo antes de
              Entradas: el organizador decide esto primero y configura los
              precios de las entradas ya sabiendo el modo elegido. */}
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                Comisión de Pasape
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                [
                  { id: "buyer_pays_extra" as const, label: "Aparte", hint: "el comprador la paga sobre tu precio" },
                  { id: "included_in_price" as const, label: "Incluida", hint: "tu precio ya la incluye, la absorbes tú" },
                ]
              ).map(({ id, label, hint }) => {
                const active = feeMode === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFeeMode(id)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-cart-accent bg-cart-accent/10"
                        : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-white"
                    }`}
                  >
                    <span className={`text-[12.5px] font-medium ${active ? "text-white" : ""}`}>{label}</span>
                    <span className="text-[11px] text-cart-ink-3">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tickets */}
          <CardButton
            icon={<IconTicket />}
            label="Entradas"
            hint={
              validTickets.length
                ? `${validTickets.length} ${validTickets.length === 1 ? "tipo" : "tipos"} · ${totalCapacity.toLocaleString("es-PE")} cupos · hasta S/ ${totalMax.toLocaleString("es-PE")} potencial`
                : "Crea al menos un tipo de entrada"
            }
            onClick={() => setOpenSheet("tickets")}
            active={validTickets.length > 0}
            required={validTickets.length === 0}
            highlight={highlight === "entradas"}
          />

          {/* Promociones — 2x1 / 3x2. Solo en edit: requiere entradas con id. */}
          {isEdit && (
            <CardButton
              icon={<IconTag />}
              label="Promociones"
              hint={
                promos.length
                  ? `${promos.length} ${promos.length === 1 ? "promo" : "promos"} activas`
                  : "Opcional — 2x1, 3x2 para llenar más rápido"
              }
              onClick={() => setOpenSheet("promos")}
              active={promos.length > 0}
            />
          )}

          {/* Promotores (solo en create — en edit usar pestaña Equipo) */}
          {!isEdit && (
            <CardButton
              icon={<IconPeople />}
              label="Promotores"
              hint={
                selectedPromoterIds.size
                  ? `${selectedPromoterIds.size} ${selectedPromoterIds.size === 1 ? "promotor" : "promotores"} del pool de la marca`
                  : (orgPromoters.data?.length ?? 0) > 0
                    ? "Elige del pool de tu marca"
                    : "Opcional — agrega tu primer promotor"
              }
              onClick={() => setOpenSheet("promoters")}
              active={selectedPromoterIds.size > 0}
            />
          )}

          {/* Layout (en edit, va aquí abajo en lugar del flyer side) */}
          {isEdit && (
            <div className="flex items-center justify-between rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
              <div className="flex items-center gap-2 text-[13px] text-cart-ink-2">
                <span className="grid size-9 place-items-center rounded-xl bg-cart-bg-elev-2 text-cart-ink-2">
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="3" width="10" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M2 6l4 3 4-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                    Distribución del local
                  </div>
                  <div className="text-[13px] font-medium text-white">
                    {layoutPreview ? "Plano cargado" : "Opcional"}
                  </div>
                </div>
              </div>
              <UploadChip
                label={layoutPreview ? "Cambiar" : "Subir"}
                onChange={onPickLayout}
                accept="image/*"
              />
            </div>
          )}
          {isEdit && layoutPreview && (
            <div className="relative overflow-hidden rounded-2xl border border-cart-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={layoutPreview} alt="" className="aspect-16/10 w-full object-cover" />
            </div>
          )}

          {/* Toggle live/draft (mobile en create) */}
          {!isEdit && (
            <div className="lg:hidden">
              <PublishToggle value={publishNow} onChange={setPublishNow} />
            </div>
          )}

          {submitError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {submitError}
            </div>
          )}

          {/* CTA desktop (en create); en edit el footer del sheet lo maneja */}
          {!isEdit && (
            <div className="mt-2 hidden lg:block">
              <SmartCta
                label={ctaLabel}
                ready={ready}
                publishNow={publishNow}
                onClick={handlePublish}
                isPending={submitting}
                accent={palette.accent}
              />
            </div>
          )}

          {/* En edit, CTA inline al final (también visible en mobile/desktop) */}
          {isEdit && (
            <div className="mt-2">
              <SmartCta
                label={ctaLabel}
                ready={ready}
                publishNow={publishNow}
                onClick={handlePublish}
                isPending={submitting}
                accent={palette.accent}
                full
              />
            </div>
          )}
        </div>
      </div>

      {/* Sticky CTA mobile (solo create) */}
      {!isEdit && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-cart-line bg-cart-bg/95 px-4 pt-3 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
        >
          <div className="mx-auto max-w-[640px]">
            <SmartCta
              label={ctaLabel}
              ready={ready}
              publishNow={publishNow}
              onClick={handlePublish}
              isPending={submitting}
                accent={palette.accent}
              full
            />
          </div>
        </div>
      )}

      {/* Sheets internos */}
      <AnimatePresence>
        {openSheet === "tickets" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Entradas">
            <TicketsEditor
              tickets={tickets}
              setTickets={setTickets}
              spaceGroups={spaceGroups}
              setSpaceGroups={setSpaceGroups}
              feeMode={feeMode}
            />
          </Sheet>
        )}
        {openSheet === "promoters" && !isEdit && (
          <Sheet onClose={() => setOpenSheet(null)} title="Promotores del evento">
            <PromoterPoolPicker
              pool={orgPromoters.data ?? []}
              loading={orgPromoters.isLoading}
              selected={selectedPromoterIds}
              setSelected={setSelectedPromoterIds}
              onCreate={(payload) =>
                createPromoter.mutateAsync(payload).then((created) => {
                  setSelectedPromoterIds(
                    new Set([...selectedPromoterIds, created.id]),
                  );
                  return created;
                })
              }
              creating={createPromoter.isPending}
            />
          </Sheet>
        )}
        {openSheet === "description" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Descripción">
            <DescriptionEditor value={description} onChange={setDescription} />
          </Sheet>
        )}
        {openSheet === "promos" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Promociones">
            <PromosEditor
              tickets={tickets.filter((t) => t.id)}
              promos={promos}
              onChange={setPromos}
            />
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Editor de paleta del evento — 3 tonos que COMBINAN entre sí (fondo, medio,
// acento), extraídos directamente del flyer al subirlo. Cada uno es
// independientemente editable (toca el círculo → su propio color picker) en
// vez de solo "agregar" un color aparte — el organizador puede ajustar
// cualquiera de los 3 sin perder los otros dos.
//
// No hay un mini-preview aparte: la paleta se aplica EN VIVO al flyer de
// respaldo y al botón principal del composer (ver `paletteGradient` y
// `SmartCta`) — el organizador ve la página real cambiar de color.
// ============================================================
function PaletteEditor({
  palette,
  loading,
  canExtractFromCover,
  onChange,
  onExtractFromCover,
  onResetToDefault,
}: {
  palette: Palette;
  loading: boolean;
  canExtractFromCover: boolean;
  onChange: (p: Palette) => void;
  onExtractFromCover: () => void;
  onResetToDefault: () => void;
}) {
  const roles: Array<{ key: keyof Palette; label: string }> = [
    { key: "dark", label: "Fondo" },
    { key: "mid", label: "Medio" },
    { key: "accent", label: "Acento" },
  ];

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-2xl border border-cart-line bg-cart-bg-elev px-3.5 py-2.5">
      <span className="shrink-0 text-[12px] font-medium text-cart-ink-2">
        Color del evento
      </span>
      <div className="flex items-center gap-3 overflow-x-auto">
        {roles.map(({ key, label }) => (
          <PaletteRoleSwatch
            key={key}
            label={label}
            hex={palette[key]}
            onChange={(hex) => onChange({ ...palette, [key]: hex })}
          />
        ))}
        {loading && (
          <span className="size-7 shrink-0 animate-pulse rounded-full bg-cart-bg-elev-2" />
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onResetToDefault}
          disabled={loading}
          className="rounded-full border border-cart-line px-3 py-1.5 text-[11.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          Volver a original
        </button>
        <button
          type="button"
          onClick={onExtractFromCover}
          disabled={!canExtractFromCover || loading}
          title={canExtractFromCover ? undefined : "Sube una portada primero"}
          className="rounded-full border border-cart-line px-3 py-1.5 text-[11.5px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          Color de la portada
        </button>
      </div>
    </div>
  );
}

function PaletteRoleSwatch({
  label,
  hex,
  onChange,
}: {
  label: string;
  hex: string;
  onChange: (hex: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`Editar color de ${label.toLowerCase()}`}
        className="grid size-7 place-items-center rounded-full transition"
        style={{ background: hex, boxShadow: "0 0 0 1px rgba(255,255,255,0.15)" }}
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
          <path d="M3 4h2l1-1.5h2L9 4h2v6H3V4z" stroke={readableTextColor(hex)} strokeWidth="1.3" />
          <circle cx="7" cy="7" r="1.6" stroke={readableTextColor(hex)} strokeWidth="1.3" />
        </svg>
      </button>
      <span className="text-[9px] font-medium uppercase tracking-wide text-cart-ink-4">
        {label}
      </span>
      <input
        ref={inputRef}
        type="color"
        value={hex}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  );
}

// ============================================================
// Cover editor (solo en edit, inline arriba)
// ============================================================
function CoverEditor({
  coverPreview,
  palette,
  onCoverFile,
  onRemoveCover,
}: {
  coverPreview: string | null;
  palette: Palette;
  onCoverFile: (file: File) => void;
  onRemoveCover: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) onCoverFile(file);
      }}
      className={`relative aspect-[16/9] w-full overflow-hidden rounded-2xl border bg-cart-bg-elev transition-colors ${
        isDragging ? "border-2 border-dashed border-white/70" : "border-cart-line"
      }`}
    >
      {coverPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: paletteGradient(palette) }} />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
      {isDragging && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-[13px] font-medium text-white">
          Suelta la imagen aquí
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCoverFile(file);
          e.target.value = "";
        }}
        className="sr-only"
      />
      {coverPreview && (
        <button
          type="button"
          onClick={onRemoveCover}
          aria-label="Quitar portada"
          className="absolute left-3 top-3 grid size-8 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11.5px] font-medium text-white backdrop-blur transition hover:bg-black/70"
      >
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M3 4h2l1-1.5h2L9 4h2v6H3V4z" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        {coverPreview ? "Cambiar portada" : "Subir portada"}
      </button>
    </div>
  );
}

// ============================================================
// Flyer card (preview en vivo, solo create)
// ============================================================
function FlyerCard({
  title,
  dateLong,
  time,
  venueName,
  coverPreview,
  palette,
  onCoverFile,
  onRemoveCover,
}: {
  title: string;
  dateLong: string | null;
  time: string;
  venueName: string;
  coverPreview: string | null;
  palette: Palette;
  onCoverFile: (file: File) => void;
  onRemoveCover: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) onCoverFile(file);
      }}
      className={`relative aspect-4/5 w-full overflow-hidden rounded-[28px] border bg-cart-bg-elev transition-colors ${
        isDragging ? "border-2 border-dashed border-white/70" : "border-cart-line-strong"
      }`}
    >
      {coverPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0" style={{ background: paletteGradient(palette) }} />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
      {isDragging && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 text-[13px] font-medium text-white">
          Suelta la imagen aquí
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-5">
        {(dateLong || time) && (
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/85">
            {dateLong ?? ""}
            {dateLong && time && " · "}
            {time}
            {venueName && ` · ${venueName.toUpperCase()}`}
          </div>
        )}
        <div className="mt-1.5 font-sans text-[28px] font-semibold leading-[1.04] tracking-tight text-white sm:text-[32px] lg:text-[36px]">
          {title || "Tu evento"}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCoverFile(file);
          e.target.value = "";
        }}
        className="sr-only"
      />
      {coverPreview && (
        <button
          type="button"
          onClick={onRemoveCover}
          aria-label="Quitar portada"
          className="absolute left-3 top-3 grid size-8 shrink-0 place-items-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur transition hover:bg-black/70"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11.5px] font-medium text-white backdrop-blur transition hover:bg-black/70"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M3 4h2l1-1.5h2L9 4h2v6H3V4z" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="7" cy="7" r="1.8" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          {coverPreview ? "Cambiar portada" : "Subir portada"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Title field
// ============================================================
function TitleField({
  value,
  onChange,
  inputRef,
  highlight,
}: {
  value: string;
  onChange: (v: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border bg-cart-bg-elev px-4 py-3 transition " +
        (highlight
          ? "border-amber-400/70 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]"
          : "border-cart-line")
      }
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        Nombre del evento
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Reverb x La Selva"
        className="mt-1.5 w-full bg-transparent font-sans text-[22px] font-semibold leading-tight tracking-[-0.02em] text-white outline-none placeholder:text-cart-ink-4 lg:text-[26px]"
      />
    </div>
  );
}

// ============================================================
// Card containers
// ============================================================
function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">{children}</div>
  );
}

function FieldShell({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        <span className="text-cart-ink-2">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

function CardButton({
  icon,
  label,
  hint,
  onClick,
  active,
  required,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  active?: boolean;
  required?: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "group flex w-full items-center gap-3 rounded-2xl border bg-cart-bg-elev px-4 py-3 text-left transition active:scale-[0.995] " +
        (highlight
          ? "border-amber-400/70 shadow-[0_0_0_4px_rgba(251,191,36,0.18)]"
          : required
            ? "border-amber-500/50"
            : active
              ? "border-cart-accent/40 hover:border-cart-accent/70"
              : "border-cart-line hover:border-cart-line-strong")
      }
    >
      <span
        className={
          "grid size-10 shrink-0 place-items-center rounded-xl " +
          (active ? "bg-cart-accent-soft text-cart-accent" : "bg-cart-bg-elev-2 text-cart-ink-2")
        }
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          {label}
          {required && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold tracking-widest text-amber-300">
              REQUERIDO
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[13.5px] font-medium text-white">{hint}</div>
      </div>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="text-cart-ink-3 transition-transform group-hover:translate-x-0.5"
      >
        <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ============================================================
// Publish toggle
// ============================================================
function PublishToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex w-full rounded-full border border-cart-line bg-cart-bg-elev p-1 lg:w-auto">
      <ToggleOpt active={value} onClick={() => onChange(true)} label="En vivo" tone="live" />
      <ToggleOpt active={!value} onClick={() => onChange(false)} label="Borrador" tone="draft" />
    </div>
  );
}

function ToggleOpt({
  active,
  onClick,
  label,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone: "live" | "draft";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition lg:flex-initial " +
        (active
          ? tone === "live"
            ? "bg-[#22D17F]/15 text-[#22D17F]"
            : "bg-cart-bg-elev-2 text-white"
          : "text-cart-ink-3 hover:text-white")
      }
    >
      <span
        className={
          "size-1.5 rounded-full " +
          (active
            ? tone === "live"
              ? "bg-[#22D17F] shadow-[0_0_8px_rgba(34,209,127,0.7)]"
              : "bg-cart-ink-2"
            : "bg-cart-ink-4")
        }
      />
      {label}
    </button>
  );
}

// ============================================================
// Smart CTA
// ============================================================
function SmartCta({
  label,
  ready,
  publishNow,
  onClick,
  isPending,
  full,
  accent,
}: {
  label: string;
  ready: boolean;
  publishNow: boolean;
  onClick: () => void;
  isPending: boolean;
  full?: boolean;
  /** Color elegido por el organizador — el CTA lo usa cuando está listo
   *  para publicar, así el botón real (no una maqueta) muestra el color. */
  accent?: string;
}) {
  const tinted = ready && publishNow && accent;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={isPending}
      whileTap={{ scale: 0.98 }}
      className={
        "inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 " +
        (full ? "w-full " : "") +
        (!ready
          ? "border border-amber-500/60 bg-amber-500/15 text-amber-200 "
          : publishNow
            ? "shadow-[0_14px_36px_-8px_var(--color-cart-accent-glow-strong)] hover:-translate-y-px " +
              (tinted ? "" : "bg-cart-accent ")
            : "border border-cart-line-strong bg-cart-bg-elev hover:border-white/40 ")
      }
      style={
        tinted
          ? { background: accent, color: readableTextColor(accent) }
          : undefined
      }
    >
      {isPending ? (
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none" className="animate-spin">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" opacity="0.3" />
          <path d="M12 7a5 5 0 00-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ) : null}
      {label}
      {ready && !isPending && (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </motion.button>
  );
}

// ============================================================
// Bottom sheet (iOS-style)
// ============================================================
function Sheet({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <motion.div
        key="bd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        key="sh"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.8 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 140 || info.velocity.y > 700) onClose();
        }}
        className="fixed inset-x-0 bottom-0 z-[101] mx-auto max-h-[88dvh] w-full max-w-[640px] touch-none overflow-y-auto rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 22px)" }}
      >
        <div className="sticky top-0 z-10 -mx-px flex flex-col bg-cart-bg-elev/95 px-5 pt-3 backdrop-blur">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/15" />
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-sans text-[20px] font-semibold tracking-[-0.02em]">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-[13px] font-semibold text-cart-accent"
            >
              Listo
            </button>
          </div>
        </div>
        <div className="px-5">{children}</div>
      </motion.div>
    </>
  );
}

// ============================================================
// PresaleTiersEditor — múltiples tramos de preventa por fecha.
// Cada tramo: precio + hasta cuándo. El backend elige el activo.
// ============================================================
function PresaleTiersEditor({
  tiers,
  base,
  onChange,
}: {
  tiers: Array<{ rowKey: string; priceSoles: string; endsAt: string }>;
  base: string;
  onChange: (tiers: Array<{ rowKey: string; priceSoles: string; endsAt: string }>) => void;
}) {
  const addTier = () =>
    onChange([...tiers, { rowKey: Math.random().toString(36).slice(2), priceSoles: "", endsAt: "" }]);
  const removeTier = (rowKey: string) => onChange(tiers.filter(t => t.rowKey !== rowKey));
  const updateTier = (rowKey: string, patch: Partial<{ priceSoles: string; endsAt: string }>) =>
    onChange(tiers.map(t => t.rowKey === rowKey ? { ...t, ...patch } : t));

  return (
    <div className="mt-2">
      {tiers.length === 0 ? (
        <button
          type="button"
          onClick={addTier}
          className="flex items-center gap-2 rounded-xl bg-cart-bg-elev px-3 py-2.5 text-[13px] font-medium text-cart-ink-2 transition hover:text-white w-full"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Agregar preventa
        </button>
      ) : (
        <div className="rounded-xl bg-cart-bg-elev px-3 py-2.5 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
            Preventas — precio final: S/ {base || "—"}
          </span>
          {tiers.map((tier, i) => {
            const dateVal = tier.endsAt ? tier.endsAt.slice(0, 10) : "";
            return (
              <div key={tier.rowKey} className="flex items-center gap-2">
                <span className="shrink-0 text-[11px] text-cart-ink-4 w-[60px]">
                  Preventa {i + 1}
                </span>
                <span className="text-[11px] text-cart-ink-4">S/</span>
                <input
                  inputMode="decimal"
                  value={tier.priceSoles}
                  onChange={e => updateTier(tier.rowKey, { priceSoles: e.target.value.replace(/[^0-9.]/g, "") })}
                  placeholder="20"
                  className="w-[54px] rounded-lg bg-cart-bg-elev-2 px-2 py-1 text-right text-[13px] font-semibold text-white outline-none ring-1 ring-cart-line focus:ring-cart-accent"
                />
                <span className="text-[11px] text-cart-ink-4 shrink-0">hasta</span>
                <div className="flex-1 min-w-[110px]">
                  <DatePicker
                    value={dateVal}
                    onChange={d => updateTier(tier.rowKey, { endsAt: d ? new Date(`${d}T23:59:00`).toISOString() : "" })}
                    placeholder="fecha"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTier(tier.rowKey)}
                  className="grid size-5 shrink-0 place-items-center rounded-full text-cart-ink-4 transition hover:text-red-300"
                  aria-label="Quitar tramo"
                >
                  <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={addTier}
            className="flex items-center gap-1.5 text-[11.5px] text-cart-ink-3 transition hover:text-white mt-0.5"
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Agregar tramo
          </button>
          <p className="text-[10.5px] text-cart-ink-4">
            Cuando termine el último tramo sube a S/ {base ?? '—'}. El comprador verá &ldquo;Preventa&rdquo; mientras esté vigente.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FreeReleaseEditor — "Liberar gratis": switch + fin opcional.
// Sin fecha = gratis mientras esté activa (la apaga el organizador).
// Con fecha = gratis hasta ese día; luego vuelve a su precio.
// ============================================================
function FreeReleaseEditor({
  isFree,
  freeUntilAt,
  base,
  onChange,
}: {
  isFree: boolean;
  freeUntilAt: string;
  base: string;
  onChange: (patch: { isFree?: boolean; freeUntilAt?: string }) => void;
}) {
  const dateVal = freeUntilAt ? freeUntilAt.slice(0, 10) : "";
  return (
    <div className="mt-2 rounded-xl bg-cart-bg-elev px-3 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <span className="text-[13px] font-semibold text-white">Liberar gratis</span>
          <p className="text-[10.5px] leading-tight text-cart-ink-4">
            Suéltala a S/ 0 sin tocar su precio. Vuelve a cobrarse cuando la cierres.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isFree}
          aria-label="Liberar gratis"
          onClick={() => onChange({ isFree: !isFree })}
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition " +
            (isFree ? "bg-emerald-500/80" : "bg-cart-bg-elev-2 ring-1 ring-cart-line")
          }
        >
          <span
            className={
              "absolute top-0.5 size-5 rounded-full bg-white transition-all " +
              (isFree ? "left-[22px]" : "left-0.5")
            }
          />
        </button>
      </div>
      {isFree && (
        <div className="mt-2.5 flex flex-col gap-1.5 border-t border-cart-line pt-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
            Vence · opcional
          </span>
          <DatePicker
            value={dateVal}
            onChange={(d) =>
              onChange({ freeUntilAt: d ? new Date(`${d}T23:59:00`).toISOString() : "" })
            }
            placeholder="Sin fecha = mientras esté activa"
          />
          <p className="text-[10.5px] text-cart-ink-4">
            {dateVal
              ? `Gratis hasta esa fecha; luego vuelve a S/ ${base || "—"}.`
              : `Gratis mientras la dejes activa; al cerrarla vuelve a S/ ${base || "—"}.`}
          </p>
        </div>
      )}
    </div>
  );
}

// BoxGroupEditor — edición masiva de boxes
function DescriptionField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="mt-2 flex flex-col gap-1 rounded-xl bg-cart-bg-elev px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        Descripción · opcional
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ej: Incluye camping, paradas vivenciales y activaciones en ruta"
        maxLength={300}
        rows={2}
        className="w-full resize-none bg-transparent text-[13px] text-white outline-none placeholder:text-cart-ink-4"
      />
      {value.length > 0 && (
        <span className="text-right text-[10px] text-cart-ink-4">{value.length}/300</span>
      )}
    </label>
  );
}

// ============================================================
function BoxGroupEditor({
  boxes,
  canDelete,
  onUpdateAll,
  onUpdateOne,
  onRemove,
  onAddOne,
  presaleRow,
  onPresaleChange,
  feeMode,
}: {
  boxes: TicketRow[];
  canDelete: boolean;
  onUpdateAll: (patch: Partial<TicketRow>) => void;
  onUpdateOne: (rowKey: string, patch: Partial<TicketRow>) => void;
  onRemove: (rowKey: string) => void;
  onAddOne: () => void;
  presaleRow: TicketRow;
  onPresaleChange: (patch: Partial<TicketRow>) => void;
  feeMode: FeeMode;
}) {
  const [advOpen, setAdvOpen] = useState(false);
  const first = boxes[0]!;
  const rawNoun = first.unitNoun || "Box";
  const nounCap = rawNoun.charAt(0).toUpperCase() + rawNoun.slice(1);
  const nounPlural =
    rawNoun.toLowerCase() === "box"
      ? "Boxes"
      : rawNoun.toLowerCase().endsWith("x") || rawNoun.toLowerCase().endsWith("z")
        ? nounCap + "es"
        : nounCap + "s";

  return (
    <div
      className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3"
      style={{ boxShadow: `inset 0 0 0 1px ${TICKET_KIND_META.box.tint}` }}
    >
      {/* Nombre del espacio · lo pone el organizador y define TODO: cómo se
          agrupan los boxes y el copy que ve el comprador ("Cada <nombre> para N
          personas", "3 <nombres> libres"). Antes había un selector Box/Mesa/
          Lounge aparte — redundante: el noun sale directo de este nombre. */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
          Nombre del espacio · tócalo para editar
        </span>
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-cart-ink-3">
            <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <input
            value={first.unitNoun}
            onChange={(e) => onUpdateAll({ unitNoun: e.target.value })}
            placeholder="Box, Mesa, Lounge…"
            maxLength={24}
            className="min-w-0 flex-1 border-b border-white/20 bg-transparent pb-0.5 text-[15px] font-semibold tracking-[-0.01em] text-white outline-none transition-colors placeholder:text-cart-ink-3 focus:border-cart-accent"
          />
          <span className="shrink-0 font-mono text-[12px] font-normal text-cart-ink-3">
            {nounPlural} ({boxes.length})
          </span>
        </div>
      </div>

      {/* Shared fields */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stepper
          label="Precio (todos)"
          suffix="S/"
          value={first.priceSoles}
          onChange={(v) => onUpdateAll({ priceSoles: v })}
        />
        <Stepper
          label="Disponibles c/u"
          value={first.capacity}
          onChange={(v) => onUpdateAll({ capacity: v })}
        />
      </div>
      <PriceFeeHint priceSoles={first.priceSoles} feeMode={feeMode} />

      <AdvancedToggle
        open={advOpen}
        onToggle={() => setAdvOpen((v) => !v)}
        hasContent={!!(first.description || presaleRow.presaleTiers.length > 0 || presaleRow.isFree)}
      />

      {/* Individual labels + precio override */}
      <div className="mt-3 border-t border-cart-line pt-3">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Individuales
        </div>
        <div className="flex flex-wrap gap-1.5">
          {boxes.map((b) => {
            const priceOverridden = b.priceSoles !== first.priceSoles;
            return (
              <div
                key={b.rowKey}
                className="flex flex-col gap-0.5 rounded-lg border border-cart-line bg-cart-bg-elev px-2 py-1.5"
              >
                <div className="flex items-center gap-1">
                  <input
                    value={b.boxLabel}
                    onChange={(e) => onUpdateOne(b.rowKey, { boxLabel: e.target.value, name: e.target.value })}
                    maxLength={20}
                    className={
                      "w-[4.5rem] bg-transparent font-mono text-[12.5px] font-semibold outline-none " +
                      (b.boxLabel.trim() ? "text-white" : "text-amber-300")
                    }
                  />
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onRemove(b.rowKey)}
                      className="grid size-4 shrink-0 place-items-center rounded-full text-cart-ink-4 transition hover:text-red-300"
                      aria-label="Eliminar"
                    >
                      <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Precio individual — gris si igual al shared, blanco si distinto */}
                <div className="flex items-center gap-0.5">
                  <span className={priceOverridden ? "text-[9px] text-cart-ink-3" : "text-[9px] text-cart-ink-4"}>
                    S/
                  </span>
                  <input
                    inputMode="numeric"
                    value={b.priceSoles}
                    onChange={(e) => onUpdateOne(b.rowKey, { priceSoles: e.target.value.replace(/[^\d]/g, "") })}
                    className={
                      "w-[3.5rem] bg-transparent font-mono text-[11px] outline-none " +
                      (priceOverridden ? "font-semibold text-white" : "text-cart-ink-4")
                    }
                  />
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onAddOne}
            className="flex items-center gap-1 rounded-lg border border-dashed border-cart-line px-2.5 py-1 text-[12px] text-cart-ink-3 transition hover:border-cart-line-strong hover:text-white"
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Agregar
          </button>
        </div>
      </div>

      {advOpen && (
        <>
          <DescriptionField
            value={first.description}
            onChange={(v) => onUpdateAll({ description: v })}
          />
          <PresaleTiersEditor
            tiers={presaleRow.presaleTiers}
            base={presaleRow.priceSoles}
            onChange={(tiers) => onPresaleChange({ presaleTiers: tiers })}
          />
          <FreeReleaseEditor
            isFree={presaleRow.isFree}
            freeUntilAt={presaleRow.freeUntilAt}
            base={presaleRow.priceSoles}
            onChange={(patch) => onUpdateAll(patch)}
          />
        </>
      )}
    </div>
  );
}

// Tickets editor
function AdvancedToggle({ open, onToggle, hasContent }: { open: boolean; onToggle: () => void; hasContent: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium text-cart-ink-3 transition hover:text-white"
    >
      <svg
        width="10" height="10" viewBox="0 0 10 10" fill="none"
        className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      >
        <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {open ? "Ocultar opciones" : (hasContent ? "Opciones avanzadas ·" : "+ Opciones avanzadas")}
      {!open && hasContent && <span className="text-cart-accent">editadas</span>}
    </button>
  );
}

// Nombre normalizado para comparar entradas: sin espacios al borde, espacios
// internos colapsados y en minúscula → "General", "general " y "General  "
// cuentan como el mismo nombre.
const normTicketName = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

// rowKeys de entradas (no-box) cuyo nombre se repite. Los boxes se distinguen
// por su etiqueta, no aplica.
function duplicateTicketRowKeys(rows: TicketRow[]): Set<string> {
  const byName = new Map<string, string[]>();
  for (const t of rows) {
    if (t.kind === "box") continue;
    const norm = normTicketName(t.name);
    if (!norm) continue;
    const arr = byName.get(norm) ?? [];
    arr.push(t.rowKey);
    byName.set(norm, arr);
  }
  const dups = new Set<string>();
  for (const arr of byName.values()) if (arr.length > 1) arr.forEach((k) => dups.add(k));
  return dups;
}

// ============================================================
function TicketsEditor({
  tickets,
  setTickets,
  spaceGroups,
  setSpaceGroups,
  feeMode,
}: {
  tickets: TicketRow[];
  setTickets: Dispatch<SetStateAction<TicketRow[]>>;
  spaceGroups: SpaceGroup[];
  setSpaceGroups: Dispatch<SetStateAction<SpaceGroup[]>>;
  feeMode: FeeMode;
}) {
  const [advancedOpen, setAdvancedOpen] = useState<Set<string>>(new Set());
  const toggleAdvanced = (rowKey: string) =>
    setAdvancedOpen((prev) => {
      const next = new Set(prev);
      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey);
      return next;
    });

  const update = (rowKey: string, patch: Partial<TicketRow>) => {
    setTickets((prev) => prev.map((t) => (t.rowKey === rowKey ? { ...t, ...patch } : t)));
  };
  const updateAll = (keys: string[], patch: Partial<TicketRow>) => {
    setTickets((prev) => prev.map((t) => (keys.includes(t.rowKey) ? { ...t, ...patch } : t)));
  };
  const remove = (rowKey: string) => {
    if (tickets.length === 1) return;
    setTickets(tickets.filter((t) => t.rowKey !== rowKey));
  };
  const add = (kind: TicketKind) => {
    const meta = TICKET_KIND_META[kind];
    setTickets([
      ...tickets,
      {
        rowKey: uid(),
        name: meta.label,
        priceSoles: kind === "box" ? "200" : "30",
        capacity: kind === "box" ? "8" : "100",
        kind,
        boxLabel:
          kind === "box"
            ? String.fromCharCode(65 + tickets.filter((t) => t.kind === "box").length)
            : "",
        unitNoun: "",
        saleEndsAt: "",
        description: "",
        presaleTiers: [],
        isFree: false,
        freeUntilAt: "",
      },
    ]);
  };

  const [bulkOpen, setBulkOpen] = useState(false);

  const nonBoxTickets = tickets.filter((t) => t.kind !== "box");
  const boxTickets = tickets.filter((t) => t.kind === "box");
  // Un grupo por tipo de unidad (boxes, mesas, lounges…) — no todo en una tarjeta.
  const boxGroups = (() => {
    const map = new Map<string, TicketRow[]>();
    for (const b of boxTickets) {
      const key = b.unitNoun.trim().toLowerCase() || "box";
      const arr = map.get(key) ?? [];
      arr.push(b);
      map.set(key, arr);
    }
    return Array.from(map.values());
  })();

  const dupKeys = duplicateTicketRowKeys(tickets);

  return (
    <div className="flex flex-col gap-3 pb-4">
      {nonBoxTickets.map((t) => {
        const isDup = dupKeys.has(t.rowKey);
        return (
        <div
          key={t.rowKey}
          className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3"
          style={{ boxShadow: `inset 0 0 0 1px ${isDup ? "rgba(244,63,94,0.55)" : TICKET_KIND_META[t.kind].tint}` }}
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
              Nombre · tócalo para editar
            </span>
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-cart-ink-3">
                <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
              <input
                value={t.name}
                onChange={(e) => update(t.rowKey, { name: e.target.value })}
                className={
                  "flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.01em] text-white outline-none placeholder:text-cart-ink-3 border-b pb-0.5 transition-colors " +
                  (isDup ? "border-rose-400/70 focus:border-rose-400" : "border-white/20 focus:border-cart-accent")
                }
                placeholder="Nombre — ej. General, VIP, After"
              />
              {tickets.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(t.rowKey)}
                  className="grid size-7 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-red-300"
                  aria-label="Eliminar"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          {isDup && (
            <p className="mt-1.5 text-[11px] font-medium text-rose-300">
              Ya tienes una entrada con este nombre. Ponle uno distinto (ej. General, VIP, General VIP).
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="relative">
              <Stepper
                label="Precio"
                suffix="S/"
                value={t.priceSoles}
                onChange={(v) => update(t.rowKey, { priceSoles: v })}
              />
              {t.priceSoles === "0" && (
                <span className="absolute right-2 top-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-300">
                  Gratis
                </span>
              )}
            </div>
            <Stepper
              label="Disponibles"
              value={t.capacity}
              onChange={(v) => update(t.rowKey, { capacity: v })}
            />
          </div>
          <PriceFeeHint priceSoles={t.priceSoles} feeMode={feeMode} />
          <AdvancedToggle
            open={advancedOpen.has(t.rowKey)}
            onToggle={() => toggleAdvanced(t.rowKey)}
            hasContent={!!(t.description || t.presaleTiers.length > 0 || t.isFree)}
          />
          {advancedOpen.has(t.rowKey) && (
            <>
              <DescriptionField value={t.description} onChange={(v) => update(t.rowKey, { description: v })} />
              <PresaleTiersEditor tiers={t.presaleTiers} base={t.priceSoles} onChange={(tiers) => update(t.rowKey, { presaleTiers: tiers })} />
              <FreeReleaseEditor isFree={t.isFree} freeUntilAt={t.freeUntilAt} base={t.priceSoles} onChange={(patch) => update(t.rowKey, patch)} />
            </>
          )}
        </div>
        );
      })}

      {/* Un grupo por tipo de unidad (Boxes, Mesas, Lounges…), no todo en uno */}
      {boxGroups.map((group) => {
        const first = group[0];
        if (group.length >= 2) {
          return (
            <BoxGroupEditor
              key={first.rowKey}
              boxes={group}
              canDelete={tickets.length > 1}
              onUpdateAll={(patch) => updateAll(group.map((b) => b.rowKey), patch)}
              onUpdateOne={(rowKey, patch) => update(rowKey, patch)}
              onRemove={(rowKey) => remove(rowKey)}
              presaleRow={first}
              onPresaleChange={(patch) => updateAll(group.map((b) => b.rowKey), patch)}
              feeMode={feeMode}
              onAddOne={() => {
                const next = String.fromCharCode(65 + group.length);
                const nounCap = first.unitNoun
                  ? first.unitNoun.charAt(0).toUpperCase() + first.unitNoun.slice(1)
                  : "Box";
                setTickets([
                  ...tickets,
                  {
                    rowKey: uid(),
                    name: `${nounCap} ${next}`,
                    priceSoles: first.priceSoles,
                    capacity: first.capacity,
                    kind: "box",
                    boxLabel: `${nounCap} ${next}`,
                    unitNoun: first.unitNoun,
                    saleEndsAt: "",
                    description: "",
                    presaleTiers: [],
                    isFree: false,
                    freeUntilAt: "",
                  },
                ]);
              }}
            />
          );
        }
        const t = first;
        return (
          <div
            key={t.rowKey}
            className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3"
            style={{ boxShadow: `inset 0 0 0 1px ${TICKET_KIND_META[t.kind].tint}` }}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
                Nombre · tócalo para editar
              </span>
              <div className="flex items-center gap-2">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-cart-ink-3">
                  <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
                <input
                  value={t.name}
                  // El noun del espacio sale del nombre que pone el organizador
                  // (agrupa y alimenta el copy del comprador) — sin selector aparte.
                  onChange={(e) => update(t.rowKey, { name: e.target.value, unitNoun: e.target.value })}
                  className="flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.01em] text-white outline-none placeholder:text-cart-ink-3 border-b border-white/20 pb-0.5 focus:border-cart-accent transition-colors"
                  placeholder="Nombre — ej. Box VIP, Mesa Premium"
                />
                {tickets.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(t.rowKey)}
                    className="grid size-7 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-red-300"
                    aria-label="Eliminar"
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stepper label="Precio" suffix="S/" value={t.priceSoles} onChange={(v) => update(t.rowKey, { priceSoles: v })} />
              <Stepper label="Cupos" value={t.capacity} onChange={(v) => update(t.rowKey, { capacity: v })} />
            </div>
            <PriceFeeHint priceSoles={t.priceSoles} feeMode={feeMode} />
            <label className="mt-2 flex flex-col gap-1 rounded-xl bg-cart-bg-elev px-3 py-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Etiqueta del box</span>
              <input
                value={t.boxLabel}
                onChange={(e) => update(t.rowKey, { boxLabel: e.target.value })}
                placeholder="A · VIP-1"
                maxLength={20}
                className={"w-full bg-transparent font-mono text-[15px] font-semibold tracking-[0.04em] outline-none " + (t.boxLabel.trim() ? "text-white" : "text-amber-300 placeholder:text-amber-300/60")}
              />
              <span className="text-[10.5px] text-cart-ink-4">Se imprime en el QR de cada invitado al box · obligatorio.</span>
            </label>
            <AdvancedToggle
              open={advancedOpen.has(t.rowKey)}
              onToggle={() => toggleAdvanced(t.rowKey)}
              hasContent={!!(t.description || t.presaleTiers.length > 0 || t.isFree)}
            />
            {advancedOpen.has(t.rowKey) && (
              <>
                <DescriptionField value={t.description} onChange={(v) => update(t.rowKey, { description: v })} />
                {/* Preventa de un box: precio bajo + fecha (un box es 1 unidad) */}
                <PresaleTiersEditor tiers={t.presaleTiers} base={t.priceSoles} onChange={(tiers) => update(t.rowKey, { presaleTiers: tiers })} />
                <FreeReleaseEditor isFree={t.isFree} freeUntilAt={t.freeUntilAt} base={t.priceSoles} onChange={(patch) => update(t.rowKey, patch)} />
              </>
            )}
          </div>
        );
      })}

      {/* Grupos de espacios (boxes/mesas) — un card define N boxes */}
      {spaceGroups.map((g) => (
        <SpaceGroupCard
          key={g.rowKey}
          group={g}
          onChange={(patch) =>
            setSpaceGroups((prev) => prev.map((x) => (x.rowKey === g.rowKey ? { ...x, ...patch } : x)))
          }
          onRemove={() => setSpaceGroups((prev) => prev.filter((x) => x.rowKey !== g.rowKey))}
          feeMode={feeMode}
        />
      ))}

      <div className="flex flex-wrap gap-2">
        {/* Entrada individual — General o VIP, el organiza solo escribe el nombre */}
        <button
          type="button"
          onClick={() => add("general")}
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-cart-line-strong px-4 py-1.5 text-[13px] font-medium text-cart-ink-2 transition hover:border-white/40 hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M2 12c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          + Nueva entrada
        </button>

        {/* Espacio reservable — agrega un grupo de boxes/mesas inline */}
        <button
          type="button"
          onClick={() => setSpaceGroups((prev) => [...prev, newSpaceGroup()])}
          className="inline-flex items-center gap-2 rounded-full border border-dashed border-cart-line-strong px-4 py-1.5 text-[13px] font-medium text-cart-ink-2 transition hover:border-white/40 hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          + Nuevo espacio (Mesa, Box, entre otros)
        </button>
      </div>
    </div>
  );
}


function Stepper({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 rounded-xl bg-cart-bg-elev px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">{label}</span>
      <div className="flex items-center gap-1">
        {suffix && <span className="font-mono text-[12px] text-cart-ink-3">{suffix}</span>}
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className="w-full bg-transparent font-mono text-[15px] font-semibold text-white outline-none"
        />
      </div>
    </label>
  );
}

// ============================================================
// Promoters picker (solo create)
// ============================================================
function PromoterPoolPicker({
  pool,
  loading,
  selected,
  setSelected,
  onCreate,
  creating,
}: {
  pool: OrgPromoter[];
  loading: boolean;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  onCreate: (payload: {
    name: string;
    whatsapp: string | null;
    defaultCommissionPct: number | null;
  }) => Promise<OrgPromoter>;
  creating: boolean;
}) {
  const [adding, setAdding] = useState(pool.length === 0);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  // null = hereda las reglas de la marca (default de un promotor nuevo).
  const [pct, setPct] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const submitNew = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        whatsapp: whatsapp.trim() ? whatsapp.trim() : null,
        defaultCommissionPct: pct,
      });
      setName("");
      setWhatsapp("");
      setPct(null);
      setAdding(false);
    } catch (e) {
      setError((e as Error).message ?? "No pudimos guardar");
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      {loading ? (
        <div className="px-3 py-6 text-center text-[13px] text-cart-ink-3">Cargando pool…</div>
      ) : pool.length === 0 && !adding ? (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-2xl border border-dashed border-cart-line-strong bg-cart-bg-elev-2 px-4 py-6 text-center text-[13.5px] font-medium text-cart-ink-2 transition hover:border-white/40 hover:text-white"
        >
          + Agregar tu primer promotor
        </button>
      ) : (
        <>
          <div className="text-[12.5px] text-cart-ink-3">
            Estos son los promotores de tu marca. Marca cuáles venden este evento.
          </div>
          <div className="flex flex-col gap-2">
            {pool.map((p) => {
              const checked = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className={
                    "flex items-center gap-3 rounded-2xl border p-3 text-left transition " +
                    (checked
                      ? "border-cart-accent bg-cart-accent-soft"
                      : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong")
                  }
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-cart-bg-elev-2 text-[12.5px] font-semibold text-cart-ink-2">
                    {(p.name[0] ?? "?").toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold">{p.name}</span>
                      {!p.profileId && (
                        <span className="rounded-full bg-amber-400/12 px-1.5 py-px text-[9px] font-semibold tracking-[0.08em] text-amber-300">
                          SIN ACTIVAR
                        </span>
                      )}
                    </div>
                    {p.whatsapp && (
                      <div className="truncate font-mono text-[11px] text-cart-ink-3">{p.whatsapp}</div>
                    )}
                  </div>
                  <span className="rounded-full bg-cart-accent-soft px-2 py-1 text-[11px] font-semibold text-cart-accent">
                    {p.defaultCommissionPct == null ? "Igual que marca" : `${p.defaultCommissionPct}%`}
                  </span>
                  <span
                    className={
                      "grid size-6 shrink-0 place-items-center rounded-full border transition " +
                      (checked
                        ? "border-cart-accent bg-cart-accent text-white"
                        : "border-cart-line-strong text-transparent")
                    }
                  >
                    <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {adding ? (
        <div className="rounded-2xl border border-dashed border-cart-line-strong bg-cart-bg-elev-2 p-3.5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Nuevo promotor
            </div>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-[11.5px] text-cart-ink-3 hover:text-white"
            >
              Cancelar
            </button>
          </div>
          <div className="mt-2.5 flex flex-col gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="rounded-xl bg-cart-bg-elev px-3 py-2.5 text-[14px] outline-none placeholder:text-cart-ink-4"
            />
            <PhoneField value={whatsapp} onChange={setWhatsapp} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPct(null)}
                className={
                  "rounded-xl px-3 py-2 text-[13px] font-semibold transition " +
                  (pct == null
                    ? "bg-cart-accent text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)]"
                    : "bg-cart-bg-elev text-cart-ink-2 hover:text-white")
                }
              >
                Igual que la marca
              </button>
              {[10, 15, 20].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPct(p)}
                  className={
                    "flex-1 rounded-xl px-3 py-2 text-[13px] font-semibold transition " +
                    (pct === p
                      ? "bg-cart-accent text-white shadow-[0_8px_20px_-6px_var(--color-cart-accent-glow)]"
                      : "bg-cart-bg-elev text-cart-ink-2 hover:text-white")
                  }
                >
                  {p}%
                </button>
              ))}
            </div>
            {error && (
              <div className="rounded-lg bg-red-500/10 px-3 py-2 text-[11.5px] text-red-300">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={submitNew}
              disabled={!name.trim() || creating}
              className="mt-1 rounded-xl bg-cart-accent py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_24px_-8px_var(--color-cart-accent-glow-strong)] disabled:opacity-50"
            >
              {creating ? "Guardando…" : "Guardar y asignar al evento"}
            </button>
          </div>
        </div>
      ) : (
        pool.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-xl border border-dashed border-cart-line-strong bg-cart-bg-elev py-2.5 text-[13px] font-medium text-cart-ink-2 transition hover:text-white"
          >
            + Crear nuevo promotor
          </button>
        )
      )}
    </div>
  );
}

// ============================================================
// Description editor
// ============================================================
function DescriptionEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="pb-4">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Lineup, vibras, dress code, lo que sea…"
        className="w-full resize-none rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-3 text-[14.5px] leading-relaxed outline-none placeholder:text-cart-ink-4 focus:border-cart-line-strong"
      />
      <div className="mt-2 text-[11.5px] text-cart-ink-4">
        {value.length} caracteres · se muestra en la página del evento
      </div>
    </div>
  );
}

// ============================================================
// Upload chip
// ============================================================
function UploadChip({
  label,
  onChange,
  accept,
}: {
  label: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  accept: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={ref} type="file" accept={accept} onChange={onChange} className="sr-only" />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="rounded-full bg-cart-bg-elev-2 px-3 py-1 text-[11.5px] font-medium text-cart-ink-2 transition hover:text-white"
      >
        {label}
      </button>
    </>
  );
}

// ============================================================
// Iconos
// ============================================================
function IconCalendar() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="2" y="3.5" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 6h10M5 2v3M9 2v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconPin() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12s4-3.5 4-7a4 4 0 10-8 0c0 3.5 4 7 4 7z" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="5" r="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
function IconText() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3 4h8M3 7h8M3 10h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconTicket() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 5a1 1 0 011-1h8a1 1 0 011 1v1a1 1 0 100 2v1a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 100-2V5z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M7 4v6" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 11.5c0-2 1.5-3 3-3s3 1 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10" cy="5.5" r="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9 11.5c.2-1.8 1.5-2.5 3-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================
// SpaceGroupCard — un card define un grupo de boxes/mesas (se expande a N)
// ============================================================
function SpaceGroupCard({
  group,
  onChange,
  onRemove,
  feeMode,
}: {
  group: SpaceGroup;
  onChange: (patch: Partial<SpaceGroup>) => void;
  onRemove: () => void;
  feeMode: FeeMode;
}) {
  const [renaming, setRenaming] = useState(false);
  const n = spaceCount(group);
  const seatsN = spaceSeats(group);
  const priceN = Number(group.priceSoles || "0");
  const setOv = (i: number, patch: { label?: string; price?: string }) =>
    onChange({ overrides: { ...group.overrides, [i]: { ...group.overrides[i], ...patch } } });
  const boxes = Array.from({ length: n }, (_, i) => {
    const ov = group.overrides[i] ?? {};
    const custom = ov.price != null && ov.price !== "";
    return { label: spaceBoxLabel(group, i), price: custom ? Number(ov.price) || 0 : priceN, custom };
  });
  const anyCustom = boxes.some((b) => b.custom);

  // Altura animada con CSS puro: medimos el contenido tras el reflow (rAF) y
  // transicionamos `height`. El rAF es clave — medir antes del reflow dejaba el
  // colapso trabado.
  const innerRef = useRef<HTMLDivElement>(null);
  const [innerH, setInnerH] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => setInnerH(el.scrollHeight));
    return () => cancelAnimationFrame(id);
  }, [renaming, n, group.scheme, group.name, group.overrides, priceN, seatsN]);

  return (
    <div
      className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3"
      style={{ boxShadow: `inset 0 0 0 1px ${TICKET_KIND_META.box.tint}` }}
    >
      {/* Nombre */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-cart-ink-4">
          Nombre · tócalo para editar
        </span>
        <div className="flex items-center gap-2">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0 text-cart-ink-3">
            <path d="M9.5 2.5l2 2-7 7H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
          <input
            value={group.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Box, Mesa, Lounge…"
            maxLength={24}
            className="flex-1 border-b border-white/20 bg-transparent pb-0.5 text-[15px] font-semibold tracking-[-0.01em] text-white outline-none transition-colors placeholder:text-cart-ink-3 focus:border-cart-accent"
          />
          <button
            type="button"
            onClick={onRemove}
            className="grid size-7 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-red-300"
            aria-label="Eliminar"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Precio · Personas/box · Cuántos */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stepper label="Precio" suffix="S/" value={group.priceSoles} onChange={(v) => onChange({ priceSoles: v })} />
        <Stepper label="Personas/box" value={group.seats} onChange={(v) => onChange({ seats: v })} />
        <Stepper label="Cuántos" value={group.count} onChange={(v) => onChange({ count: v })} />
      </div>
      <PriceFeeHint priceSoles={group.priceSoles} feeMode={feeMode} />

      {/* Etiquetas de los boxes */}
      <div className="mt-2 flex flex-col gap-1 rounded-xl bg-cart-bg-elev px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Etiquetas de los boxes</span>
        <div className="mt-1 flex gap-1.5">
          {(["alpha", "num"] as const).map((s) => {
            const active = group.scheme === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ scheme: s })}
                className={
                  "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors " +
                  (active ? "border-cart-accent bg-cart-accent/15 text-white" : "border-cart-line text-cart-ink-3 hover:text-white")
                }
              >
                {s === "alpha" ? "Letras · A B C" : "Números · 1 2 3"}
              </button>
            );
          })}
        </div>
        <span className="mt-0.5 text-[10.5px] text-cart-ink-4">La etiqueta viaja en el QR de cada invitado · identifica el box en la puerta.</span>
      </div>

      {/* Vista previa — altura animada con CSS (height medido + transición) */}
      <div className="mt-2 rounded-xl bg-cart-bg-elev px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Vista previa · {n} {n === 1 ? "box" : "boxes"}</span>
          {n > 0 && (
            <button
              type="button"
              onClick={(e) => {
                setRenaming((v) => !v);
                e.currentTarget.blur();
              }}
              className="rounded text-[12px] font-semibold text-cart-accent outline-none focus-visible:ring-2 focus-visible:ring-cart-accent/40"
            >
              {renaming ? "Listo" : "Editar c/u"}
            </button>
          )}
        </div>
        <div
          className="overflow-hidden transition-[height] duration-200 ease-linear"
          style={{ height: innerH }}
        >
          <div ref={innerRef}>
            {n === 0 ? (
              <p className="py-3 text-center text-[12.5px] text-cart-ink-4">Indica cuántos boxes crear.</p>
            ) : renaming ? (
              <div className="flex flex-col gap-1.5">
                {boxes.map((b, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-4 shrink-0 text-[11px] text-cart-ink-4">{i + 1}.</span>
                    <input
                      value={group.overrides[i]?.label ?? spaceBoxLabel(group, i)}
                      onChange={(e) => setOv(i, { label: e.target.value })}
                      className="min-w-0 flex-1 rounded-lg border border-cart-line bg-cart-bg-elev-2 px-2 py-1 font-mono text-[13px] font-semibold text-white outline-none focus:border-cart-accent"
                    />
                    <div className={"flex w-[84px] shrink-0 items-center gap-1 rounded-lg border bg-cart-bg-elev-2 px-2 py-1 " + (b.custom ? "border-cart-accent/60" : "border-cart-line")}>
                      <span className="font-mono text-[11px] text-cart-ink-3">S/</span>
                      <input inputMode="numeric" value={group.overrides[i]?.price ?? ""} onChange={(e) => setOv(i, { price: e.target.value.replace(/[^\d]/g, "") })} placeholder={String(priceN)} className="w-full bg-transparent font-mono text-[13px] font-semibold text-white outline-none placeholder:text-cart-ink-4" />
                    </div>
                  </div>
                ))}
                <span className="px-1 text-[10.5px] text-cart-ink-4">Vacío = usa el precio de la categoría (S/ {priceN.toLocaleString("es-PE")}).</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {boxes.map((b, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-cart-line bg-cart-bg-elev-2 px-2.5 py-1 text-[12px]">
                    <span className="font-mono font-semibold tracking-[0.04em] text-white">{b.label}</span>
                    <span className="text-cart-ink-4">· {seatsN}p</span>
                    {b.custom && <span className="font-mono text-cart-accent">· S/{b.price.toLocaleString("es-PE")}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-cart-line pt-2 text-[12px] text-cart-ink-3">
          <span><span className="font-semibold text-white">{n}</span> boxes</span>
          <span><span className="font-semibold text-white">{n * seatsN}</span> personas</span>
          <span>{anyCustom ? `S/ ${Math.min(...boxes.map((b) => b.price)).toLocaleString("es-PE")}–${Math.max(...boxes.map((b) => b.price)).toLocaleString("es-PE")}` : `S/ ${priceN.toLocaleString("es-PE")} c/u`}</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// IconTag / PromosEditor — Promociones 2x1 / 3x2 (sección aparte de preventa).
// ============================================================
function IconTag() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
      <path
        d="M2 2.5h4.2L12 8.3l-3.7 3.7L2.5 6.2V2.5z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="4.6" cy="4.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

const PROMO_COPY: Record<PromoKind, string> = {
  "2x1": "Llevan 2, pagan 1",
  "3x2": "Llevan 3, pagan 2",
};

function PromosEditor({
  tickets,
  promos,
  onChange,
}: {
  tickets: TicketRow[];
  promos: PromoDraft[];
  onChange: (next: PromoDraft[]) => void;
}) {
  const options = tickets.filter((t) => t.kind !== "box" && t.id);
  const nameOf = (id: string) => options.find((o) => o.id === id)?.name || "—";
  const add = (kind: PromoKind) =>
    onChange([...promos, { ticketTypeId: options[0]?.id ?? "", kind, endsAt: null }]);
  const patch = (i: number, p: Partial<PromoDraft>) =>
    onChange(promos.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
  const remove = (i: number) => onChange(promos.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3 pb-4">
      {options.length === 0 && (
        <p className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 px-4 py-5 text-center text-[13px] text-cart-ink-3">
          Primero crea una entrada. Las promos se aplican sobre una entrada.
        </p>
      )}
      {promos.length === 0 && options.length > 0 && (
        <p className="px-1 text-[12.5px] leading-relaxed text-cart-ink-4">
          Ofertas para llenar más rápido. Ej: &ldquo;2x1 en General hasta el viernes&rdquo;.
        </p>
      )}

      {promos.map((promo, i) => (
        <div key={i} className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3">
          <div className="flex items-center gap-2">
            <span
              className="rounded-lg px-2.5 py-1 text-[13px] font-bold tracking-wide"
              style={{ background: "rgba(184,124,255,0.15)", color: "var(--color-cart-accent)" }}
            >
              {promo.kind}
            </span>
            <span className="text-[13px] text-cart-ink-3">en</span>
            <select
              value={promo.ticketTypeId}
              onChange={(e) => patch(i, { ticketTypeId: e.target.value })}
              className="flex-1 rounded-lg bg-cart-bg-elev px-2.5 py-1.5 text-[13.5px] font-semibold text-white outline-none ring-1 ring-cart-line focus:ring-cart-accent"
            >
              {options.map((o) => (
                <option key={o.id} value={o.id!}>
                  {o.name || "Entrada"}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => remove(i)}
              className="grid size-7 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-red-300"
              aria-label="Eliminar promo"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-[12px] text-cart-ink-3">
            {PROMO_COPY[promo.kind]} · en {nameOf(promo.ticketTypeId)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-cart-ink-2">
            <span className="text-cart-ink-3">Hasta</span>
            <div className="min-w-[150px] flex-1">
              <DatePicker
                value={promo.endsAt ? promo.endsAt.slice(0, 10) : ""}
                onChange={(d) =>
                  patch(i, { endsAt: d ? new Date(`${d}T23:59:00`).toISOString() : null })
                }
                placeholder="elige fecha · opcional"
              />
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-cart-ink-4">Sin fecha = vale toda la venta.</p>
        </div>
      ))}

      {options.length > 0 && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => add("2x1")}
            className="flex-1 rounded-xl border border-dashed border-cart-line py-2.5 text-[13px] font-semibold text-cart-ink-2 transition hover:border-white/25 hover:text-white"
          >
            + 2x1
          </button>
          <button
            type="button"
            onClick={() => add("3x2")}
            className="flex-1 rounded-xl border border-dashed border-cart-line py-2.5 text-[13px] font-semibold text-cart-ink-2 transition hover:border-white/25 hover:text-white"
          >
            + 3x2
          </button>
        </div>
      )}
    </div>
  );
}
