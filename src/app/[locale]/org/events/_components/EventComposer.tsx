"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "@/i18n/navigation";
import { useCreateEvent } from "@/lib/events/hooks/useCreateEvent";
import { useUpdateEvent } from "@/lib/events/hooks/useUpdateEvent";
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
  TicketType,
  TicketTypeKind,
} from "@/server/events/domain/Event";
import { createSupabaseBrowserClient } from "@/server/_shared/supabase/client";

// ============================================================
// Tipos
// ============================================================
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
  /** Zona del venue para agrupar la lista al comprador. Opcional. */
  zone: string;
  /** Cómo llama el organizador a la unidad reservable: box, mesa, lounge u otro. */
  unitNoun: string;
  /** ISO 8601. Cierre de ventas de este tipo (solo relevante para kind=presale). */
  saleEndsAt: string;
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
const toCents = (s: string) => Math.round(Number(s || "0") * 100);
const fromCents = (n: number) => (n / 100).toString();

const TICKET_KIND_META: Record<TicketKind, { label: string; tint: string }> = {
  general: { label: "General", tint: "rgba(184,124,255,0.55)" },
  presale: { label: "Preventa", tint: "rgba(56,189,248,0.55)" },
  vip: { label: "VIP", tint: "rgba(255,206,59,0.55)" },
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
    const rows: TicketRow[] = props.initial.ticketTypes.map((tt) => ({
      id: tt.id,
      rowKey: tt.id,
      name: tt.name,
      kind: tt.kind,
      priceSoles: fromCents(tt.priceCents),
      capacity: String(tt.capacity),
      boxLabel: tt.boxLabel ?? "",
      zone: tt.zone ?? "",
      unitNoun: tt.unitNoun ?? "",
      saleEndsAt: tt.saleEndsAt ?? "",
    }));
    const endDt = ev.endsAt ? isoToDateTime(ev.endsAt, ev.timezone) : null;
    return {
      title: ev.title,
      description: ev.description ?? "",
      date,
      time,
      endDate: endDt?.date ?? "",
      endTime: endDt?.time ?? "",
      venue: venueValue,
      coverUrl: ev.coverUrl,
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
                zone: "",
                unitNoun: "",
                saleEndsAt: "",
              },
            ],
      publishNow: ev.status === "published",
    };
    // initial is stable per mount in edit mode (we re-mount per slug).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);

  const [title, setTitle] = useState(seedFromEdit?.title ?? "");
  const [description, setDescription] = useState(seedFromEdit?.description ?? "");
  const [date, setDate] = useState(seedFromEdit?.date ?? "");
  const [time, setTime] = useState(seedFromEdit?.time ?? "");
  const [endDate, setEndDate] = useState(seedFromEdit?.endDate ?? "");
  const [endTime, setEndTime] = useState(seedFromEdit?.endTime ?? "");
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
        zone: "",
        unitNoun: "",
        saleEndsAt: "",
      },
    ],
  );
  const [selectedPromoterIds, setSelectedPromoterIds] = useState<Set<string>>(
    new Set(),
  );
  const orgPromoters = useOrgPromoters();
  const createPromoter = useCreateOrgPromoter();
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(
    seedFromEdit?.coverUrl ?? null,
  );
  const [layoutFile, setLayoutFile] = useState<File | null>(null);
  const [layoutPreview, setLayoutPreview] = useState<string | null>(
    seedFromEdit?.layoutUrl ?? null,
  );
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishNow, setPublishNow] = useState(seedFromEdit?.publishNow ?? true);
  const [openSheet, setOpenSheet] = useState<
    null | "tickets" | "promoters" | "description"
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
  const totalCapacity = useMemo(
    () => tickets.reduce((a, t) => a + Number(t.capacity || 0), 0),
    [tickets],
  );
  const totalMax = useMemo(
    () =>
      tickets.reduce(
        (a, t) => a + Number(t.capacity || 0) * Number(t.priceSoles || 0),
        0,
      ),
    [tickets],
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
      t.name &&
      Number(t.capacity) > 0 &&
      (t.kind !== "box" || t.boxLabel.trim().length > 0),
  );

  const missingFields = useMemo(() => {
    const m: string[] = [];
    if (!title.trim()) m.push("nombre");
    if (!date) m.push("fecha");
    if (!time) m.push("hora");
    if (validTickets.length === 0) m.push("entradas");
    return m;
  }, [title, date, time, validTickets.length]);

  const ready = missingFields.length === 0;

  // ---------- focus al campo faltante ----------
  const focusFirstMissing = () => {
    const first = missingFields[0];
    if (!first) return;
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
      const ticketTypes = validTickets.map((t) => ({
        name: t.name,
        kind: t.kind,
        priceCents: toCents(t.priceSoles),
        capacity: Number(t.capacity),
        boxLabel: t.kind === "box" ? t.boxLabel.trim() : null,
        zone: t.zone.trim() || null,
        unitNoun: t.kind === "box" ? t.unitNoun.trim() || null : null,
        saleEndsAt: t.saleEndsAt || null,
      }));

      let venueLayoutUrl: string | null = null;
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
              await uploadEventAsset(coverFile, { slugHint: title, kind: "cover" });
            } catch {
              // si falla el cover no bloqueamos
            }
          }
        } finally {
          setUploadingAssets(false);
        }
      }

      const endsAt =
        endDate && endTime
          ? new Date(`${endDate}T${endTime}:00`).toISOString()
          : null;
      const ev = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        venue: venue.name.trim() || null,
        venueLat: venue.lat,
        venueLng: venue.lng,
        venueUrl: venue.url,
        venueSource: venue.source,
        venueLayoutUrl,
        startsAt,
        endsAt,
        timezone: "America/Lima",
        ticketTypes,
        transfersEnabled: true,
        transferRequiresKyc: false,
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
      const nextVenueName = venue.name.trim() || null;
      if (nextVenueName !== ev.venue) patch.venue = nextVenueName;
      if (venue.lat !== ev.venueLat) patch.venueLat = venue.lat;
      if (venue.lng !== ev.venueLng) patch.venueLng = venue.lng;
      if (venue.url !== ev.venueUrl) patch.venueUrl = venue.url;
      if (venue.source !== ev.venueSource) patch.venueSource = venue.source;
      if (startsAt !== ev.startsAt) patch.startsAt = startsAt;
      if (endDate && endTime) {
        const nextEndsAt = new Date(`${endDate}T${endTime}:00`).toISOString();
        if (nextEndsAt !== ev.endsAt) patch.endsAt = nextEndsAt;
      } else if (!endDate && ev.endsAt) {
        patch.endsAt = null;
      }
      if (nextCoverUrl !== undefined) patch.coverUrl = nextCoverUrl;
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

      // Crear nuevos
      const toCreate = validTickets.filter((t) => !t.id);
      for (const t of toCreate) {
        await createTT.mutateAsync({
          name: t.name,
          kind: t.kind,
          priceCents: toCents(t.priceSoles),
          capacity: Number(t.capacity),
          boxLabel: t.kind === "box" ? t.boxLabel.trim() : null,
          zone: t.zone.trim() || null,
          unitNoun: t.kind === "box" ? t.unitNoun.trim() || null : null,
          saleEndsAt: t.saleEndsAt || null,
        });
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
        if (nextCap !== orig.capacity) ttPatch.capacity = nextCap;
        const nextLabel = t.kind === "box" ? t.boxLabel.trim() : null;
        if (nextLabel !== orig.boxLabel) ttPatch.boxLabel = nextLabel;
        const nextZone = t.zone.trim() || null;
        if (nextZone !== orig.zone) ttPatch.zone = nextZone;
        const nextNoun =
          t.kind === "box" ? t.unitNoun.trim() || null : null;
        if (nextNoun !== orig.unitNoun) ttPatch.unitNoun = nextNoun;
        const nextSaleEndsAt = t.saleEndsAt || null;
        if (nextSaleEndsAt !== orig.saleEndsAt) ttPatch.saleEndsAt = nextSaleEndsAt;
        if (Object.keys(ttPatch).length > 0) {
          await updateTT.mutateAsync({ id: t.id!, input: ttPatch });
        }
      }

      // Borrar los que estaban antes y ya no están
      for (const origId of originalTicketIds) {
        if (!currentIds.has(origId)) {
          await deleteTT.mutateAsync(origId);
        }
      }

      props.onClose?.();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  const handlePublish = isEdit ? handleEdit : handleCreate;

  const onPickCover = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const onPickLayout = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLayoutFile(file);
    setLayoutPreview(URL.createObjectURL(file));
  };

  // CTA inteligente
  const submitting =
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
              onPickCover={onPickCover}
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
              onPickCover={onPickCover}
            />
          )}

          {/* Nombre */}
          <TitleField
            value={title}
            onChange={setTitle}
            inputRef={titleRef}
            highlight={highlight === "nombre"}
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

          {/* Fin de ventas (opcional) */}
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-3">
              <div>
                <FieldShell icon={<IconCalendar />} label="Fin de ventas">
                  <DatePicker value={endDate} onChange={setEndDate} placeholder="Opcional" />
                </FieldShell>
              </div>
              <div>
                <FieldShell icon={<IconClock />} label="Hora de cierre">
                  <TimePicker value={endTime} onChange={setEndTime} placeholder="Opcional" />
                </FieldShell>
              </div>
            </div>
            {!endDate && !endTime && (
              <p className="mt-2 text-[11px] text-cart-ink-4">
                Opcional — bloquea nuevas compras a partir de esta fecha y hora.
              </p>
            )}
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

          {/* Descripción */}
          <CardButton
            icon={<IconText />}
            label="Descripción"
            hint={description ? truncate(description, 80) : "Opcional — vibras, lineup, dress code"}
            onClick={() => setOpenSheet("description")}
            active={!!description.trim()}
          />

          {/* Tickets */}
          <CardButton
            icon={<IconTicket />}
            label="Entradas"
            hint={
              validTickets.length
                ? `${validTickets.length} ${validTickets.length === 1 ? "tipo" : "tipos"} · ${totalCapacity.toLocaleString("es-PE")} cupos · S/ ${totalMax.toLocaleString("es-PE")} máx`
                : "Crea al menos un tipo de entrada"
            }
            onClick={() => setOpenSheet("tickets")}
            active={validTickets.length > 0}
            required={validTickets.length === 0}
            highlight={highlight === "entradas"}
          />

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
              full
            />
          </div>
        </div>
      )}

      {/* Sheets internos */}
      <AnimatePresence>
        {openSheet === "tickets" && (
          <Sheet onClose={() => setOpenSheet(null)} title="Entradas">
            <TicketsEditor tickets={tickets} setTickets={setTickets} />
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
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// Cover editor (solo en edit, inline arriba)
// ============================================================
function CoverEditor({
  coverPreview,
  onPickCover,
}: {
  coverPreview: string | null;
  onPickCover: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-cart-line bg-cart-bg-elev">
      {coverPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 35%, #FF4D5E 100%)",
          }}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/10 to-transparent" />
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onPickCover}
        className="sr-only"
      />
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
  onPickCover,
}: {
  title: string;
  dateLong: string | null;
  time: string;
  venueName: string;
  coverPreview: string | null;
  onPickCover: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative aspect-4/5 w-full overflow-hidden rounded-[28px] border border-cart-line-strong bg-cart-bg-elev">
      {coverPreview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #4B1F9A 0%, #7C3AED 35%, #FF4D5E 100%)",
          }}
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
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
        onChange={onPickCover}
        className="sr-only"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/45 px-3 py-1.5 text-[11.5px] font-medium text-white backdrop-blur transition hover:bg-black/70"
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
}: {
  label: string;
  ready: boolean;
  publishNow: boolean;
  onClick: () => void;
  isPending: boolean;
  full?: boolean;
}) {
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
            ? "bg-cart-accent shadow-[0_14px_36px_-8px_var(--color-cart-accent-glow-strong)] hover:-translate-y-px "
            : "border border-cart-line-strong bg-cart-bg-elev hover:border-white/40 ")
      }
    >
      {label}
      {ready && (
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
// SaleEndsAtPicker — cierre automático de ventas por tipo
// ============================================================
function SaleEndsAtPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [date, setDate] = useState(() => (value ? value.slice(0, 10) : ""));
  const [time, setTime] = useState(() => {
    if (!value) return "";
    const d = new Date(value);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const sync = (d: string, t: string) => {
    if (d && t) onChange(new Date(`${d}T${t}:00`).toISOString());
    else onChange("");
  };

  return (
    <div className="mt-2 rounded-xl bg-cart-bg-elev px-3 py-2">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400/80">
        Cierre de preventa
      </div>
      <div className="grid grid-cols-2 gap-2">
        <DatePicker
          value={date}
          onChange={(v) => { setDate(v); sync(v, time); }}
          placeholder="Fecha límite"
        />
        <TimePicker
          value={time}
          onChange={(v) => { setTime(v); sync(date, v); }}
          placeholder="Hora"
        />
      </div>
      {date && time ? (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10.5px] text-cart-ink-3">
            Ventas cierran el{" "}
            {new Date(`${date}T${time}:00`).toLocaleDateString("es-PE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <button
            type="button"
            onClick={() => { setDate(""); setTime(""); onChange(""); }}
            className="text-[10px] text-cart-ink-4 transition hover:text-white"
          >
            Quitar
          </button>
        </div>
      ) : (
        <p className="mt-1.5 text-[10.5px] text-cart-ink-4">
          Sin fecha límite — se vende hasta que el evento cierre o se agote.
        </p>
      )}
    </div>
  );
}

// BoxGroupEditor — edición masiva de boxes
// ============================================================
function BoxGroupEditor({
  boxes,
  canDelete,
  knownZones,
  onUpdateAll,
  onUpdateOne,
  onRemove,
  onAddOne,
}: {
  boxes: TicketRow[];
  canDelete: boolean;
  knownZones: string[];
  onUpdateAll: (patch: Partial<TicketRow>) => void;
  onUpdateOne: (rowKey: string, patch: Partial<TicketRow>) => void;
  onRemove: (rowKey: string) => void;
  onAddOne: () => void;
}) {
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
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[15px] font-semibold tracking-[-0.01em] text-white">
          {nounPlural}
          <span className="ml-1.5 font-mono text-[12px] font-normal text-cart-ink-3">
            ({boxes.length})
          </span>
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em]"
          style={{ background: `${TICKET_KIND_META.box.tint}22`, color: TICKET_KIND_META.box.tint }}
        >
          Box
        </span>
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
          label="Aforo c/u"
          value={first.capacity}
          onChange={(v) => onUpdateAll({ capacity: v })}
        />
      </div>

      {/* Noun picker (shared) */}
      <div className="mt-2">
        <UnitNounPicker
          value={first.unitNoun}
          onChange={(v) => onUpdateAll({ unitNoun: v })}
        />
      </div>

      {/* Zone (shared) */}
      <label className="mt-2 flex items-center gap-2 rounded-xl bg-cart-bg-elev px-3 py-2">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Zona
        </span>
        <input
          value={first.zone}
          onChange={(e) => onUpdateAll({ zone: e.target.value })}
          placeholder="Opcional"
          maxLength={60}
          list="box-group-zones"
          className="w-full bg-transparent text-[13.5px] text-white outline-none placeholder:text-cart-ink-4"
        />
        <datalist id="box-group-zones">
          {knownZones.filter((z) => z !== first.zone).map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
      </label>

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
    </div>
  );
}

// Tickets editor
// ============================================================
function TicketsEditor({
  tickets,
  setTickets,
}: {
  tickets: TicketRow[];
  setTickets: (rows: TicketRow[]) => void;
}) {
  const update = (rowKey: string, patch: Partial<TicketRow>) => {
    setTickets(tickets.map((t) => (t.rowKey === rowKey ? { ...t, ...patch } : t)));
  };
  const updateAll = (keys: string[], patch: Partial<TicketRow>) => {
    setTickets(tickets.map((t) => (keys.includes(t.rowKey) ? { ...t, ...patch } : t)));
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
        priceSoles:
          kind === "vip" ? "80" : kind === "box" ? "200" : kind === "presale" ? "20" : "30",
        capacity: kind === "box" ? "8" : "100",
        kind,
        boxLabel:
          kind === "box"
            ? String.fromCharCode(65 + tickets.filter((t) => t.kind === "box").length)
            : "",
        zone: "",
        unitNoun: "",
        saleEndsAt: "",
      },
    ]);
  };

  const knownZones = useMemo(
    () =>
      Array.from(
        new Set(tickets.map((t) => t.zone.trim()).filter((z) => z.length > 0)),
      ),
    [tickets],
  );
  const [bulkOpen, setBulkOpen] = useState(false);

  const nonBoxTickets = tickets.filter((t) => t.kind !== "box");
  const boxTickets = tickets.filter((t) => t.kind === "box");

  return (
    <div className="flex flex-col gap-3 pb-4">
      {nonBoxTickets.map((t) => (
        <div
          key={t.rowKey}
          className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3"
          style={{ boxShadow: `inset 0 0 0 1px ${TICKET_KIND_META[t.kind].tint}` }}
        >
          <div className="flex items-center gap-2">
            <input
              value={t.name}
              onChange={(e) => update(t.rowKey, { name: e.target.value })}
              className="flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.01em] text-white outline-none placeholder:text-cart-ink-3"
              placeholder="Nombre del tipo"
            />
            <KindPicker value={t.kind} onChange={(k) => update(t.rowKey, { kind: k })} />
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
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stepper
              label="Precio"
              suffix="S/"
              value={t.priceSoles}
              onChange={(v) => update(t.rowKey, { priceSoles: v })}
            />
            <Stepper
              label="Cupos"
              value={t.capacity}
              onChange={(v) => update(t.rowKey, { capacity: v })}
            />
          </div>
          <label className="mt-2 flex items-center gap-2 rounded-xl bg-cart-bg-elev px-3 py-2">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Zona
            </span>
            <input
              value={t.zone}
              onChange={(e) => update(t.rowKey, { zone: e.target.value })}
              placeholder="Ej: Boxes Premium · opcional"
              maxLength={60}
              list={`zones-${t.rowKey}`}
              className="w-full bg-transparent text-[13.5px] text-white outline-none placeholder:text-cart-ink-4"
            />
            <datalist id={`zones-${t.rowKey}`}>
              {knownZones
                .filter((z) => z !== t.zone)
                .map((z) => (
                  <option key={z} value={z} />
                ))}
            </datalist>
          </label>
          {t.kind === "presale" && (
            <SaleEndsAtPicker
              value={t.saleEndsAt}
              onChange={(v) => update(t.rowKey, { saleEndsAt: v })}
            />
          )}
        </div>
      ))}

      {/* Boxes agrupados: 2+ → tarjeta única con edición masiva */}
      {boxTickets.length >= 2 && (
        <BoxGroupEditor
          boxes={boxTickets}
          canDelete={tickets.length > 1}
          knownZones={knownZones}
          onUpdateAll={(patch) => updateAll(boxTickets.map((b) => b.rowKey), patch)}
          onUpdateOne={(rowKey, patch) => update(rowKey, patch)}
          onRemove={(rowKey) => remove(rowKey)}
          onAddOne={() => {
            const next = String.fromCharCode(65 + boxTickets.length);
            const first = boxTickets[0];
            setTickets([
              ...tickets,
              {
                rowKey: uid(),
                name: `${first?.unitNoun ? first.unitNoun.charAt(0).toUpperCase() + first.unitNoun.slice(1) : "Box"} ${next}`,
                priceSoles: first?.priceSoles ?? "1500",
                capacity: first?.capacity ?? "12",
                kind: "box",
                boxLabel: `${first?.unitNoun ? first.unitNoun.charAt(0).toUpperCase() + first.unitNoun.slice(1) : "Box"} ${next}`,
                zone: first?.zone ?? "",
                unitNoun: first?.unitNoun ?? "",
                saleEndsAt: "",
              },
            ]);
          }}
        />
      )}

      {/* Si solo hay 1 box, mostrarlo como tarjeta individual normal */}
      {boxTickets.length === 1 &&
        boxTickets.map((t) => (
          <div
            key={t.rowKey}
            className="rounded-2xl border border-cart-line bg-cart-bg-elev-2 p-3"
            style={{ boxShadow: `inset 0 0 0 1px ${TICKET_KIND_META[t.kind].tint}` }}
          >
            <div className="flex items-center gap-2">
              <input
                value={t.name}
                onChange={(e) => update(t.rowKey, { name: e.target.value })}
                className="flex-1 bg-transparent text-[15px] font-semibold tracking-[-0.01em] text-white outline-none placeholder:text-cart-ink-3"
                placeholder="Nombre del box"
              />
              <KindPicker value={t.kind} onChange={(k) => update(t.rowKey, { kind: k })} />
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
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stepper label="Precio" suffix="S/" value={t.priceSoles} onChange={(v) => update(t.rowKey, { priceSoles: v })} />
              <Stepper label="Cupos" value={t.capacity} onChange={(v) => update(t.rowKey, { capacity: v })} />
            </div>
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
            <UnitNounPicker value={t.unitNoun} onChange={(v) => update(t.rowKey, { unitNoun: v })} />
            <label className="mt-2 flex items-center gap-2 rounded-xl bg-cart-bg-elev px-3 py-2">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Zona</span>
              <input value={t.zone} onChange={(e) => update(t.rowKey, { zone: e.target.value })} placeholder="Opcional" maxLength={60} className="w-full bg-transparent text-[13.5px] text-white outline-none placeholder:text-cart-ink-4" />
            </label>
          </div>
        ))
      }

      <div className="flex flex-wrap gap-2">
        <AddKindButton kind="general" onClick={() => add("general")} />
        <AddKindButton kind="presale" onClick={() => add("presale")} />
        <AddKindButton kind="vip" onClick={() => add("vip")} />
        <AddKindButton kind="box" onClick={() => add("box")} />
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-cart-accent/15 px-3.5 py-1.5 text-[12.5px] font-semibold text-cart-accent transition hover:bg-cart-accent/25"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <rect x="1.5" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <rect x="8" y="1.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <rect x="1.5" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
            <rect x="8" y="8" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          Crear varios boxes
        </button>
      </div>

      {bulkOpen && (
        <BulkBoxCreator
          knownZones={knownZones}
          onClose={() => setBulkOpen(false)}
          onCreate={(rows) => {
            setTickets([...tickets, ...rows]);
            setBulkOpen(false);
          }}
        />
      )}
    </div>
  );
}

function AddKindButton({ kind, onClick }: { kind: TicketKind; onClick: () => void }) {
  const meta = TICKET_KIND_META[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-cart-line-strong px-3.5 py-1.5 text-[12.5px] font-medium text-cart-ink-2 transition hover:border-white/40 hover:text-white"
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.tint }} />
      + {meta.label}
    </button>
  );
}

function KindPicker({
  value,
  onChange,
}: {
  value: TicketKind;
  onChange: (k: TicketKind) => void;
}) {
  const meta = TICKET_KIND_META[value];
  const order: TicketKind[] = ["general", "presale", "vip", "box"];
  const next = () => {
    const idx = order.indexOf(value);
    onChange(order[(idx + 1) % order.length]);
  };
  return (
    <button
      type="button"
      onClick={next}
      className="inline-flex items-center gap-1.5 rounded-full bg-cart-bg-elev px-2.5 py-1 text-[11px] font-semibold tracking-[0.06em] text-cart-ink-2 transition hover:text-white"
    >
      <span className="size-1.5 rounded-full" style={{ background: meta.tint }} />
      {meta.label.toUpperCase()}
    </button>
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
    defaultCommissionPct: number;
  }) => Promise<OrgPromoter>;
  creating: boolean;
}) {
  const [adding, setAdding] = useState(pool.length === 0);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pct, setPct] = useState(15);
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
      setPct(15);
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
                    {p.defaultCommissionPct}%
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
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+51 9XX XXX XXX (opcional)"
              inputMode="tel"
              className="rounded-xl bg-cart-bg-elev px-3 py-2.5 font-mono text-[13.5px] outline-none placeholder:text-cart-ink-4"
            />
            <div className="flex gap-2">
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
// Bulk box creator — genera N boxes en una zona en 30 segundos
// ============================================================
type NounPreset = "box" | "mesa" | "lounge" | "custom";
type NumberingScheme = "num" | "alpha";

const NOUN_PRESETS: Array<{ id: NounPreset; label: string }> = [
  { id: "box", label: "Box" },
  { id: "mesa", label: "Mesa" },
  { id: "lounge", label: "Lounge" },
  { id: "custom", label: "Otro" },
];

const capitalizeNoun = (s: string): string =>
  s.length === 0 ? s : s[0].toUpperCase() + s.slice(1).toLowerCase();

function BulkBoxCreator({
  knownZones,
  onClose,
  onCreate,
}: {
  knownZones: string[];
  onClose: () => void;
  onCreate: (rows: TicketRow[]) => void;
}) {
  const [zone, setZone] = useState(knownZones[0] ?? "");
  const [nounPreset, setNounPreset] = useState<NounPreset>("box");
  const [customNoun, setCustomNoun] = useState("Espacio");
  const [numbering, setNumbering] = useState<NumberingScheme>("num");
  const [startNumber, setStartNumber] = useState("1");
  const [startLetter, setStartLetter] = useState("A");
  const [quantity, setQuantity] = useState("10");
  const [capacity, setCapacity] = useState("12");
  const [priceSoles, setPriceSoles] = useState("1500");

  const qty = Math.max(0, Math.min(60, Number(quantity) || 0));
  const start =
    numbering === "alpha"
      ? Math.max(1, (startLetter.toUpperCase().charCodeAt(0) - 64) || 1)
      : Math.max(1, Number(startNumber) || 1);
  const cap = Math.max(1, Number(capacity) || 1);

  const effectiveNoun =
    nounPreset === "custom" ? customNoun.trim() || "Espacio" : NOUN_PRESETS.find((p) => p.id === nounPreset)!.label;

  const labels = useMemo(() => {
    return Array.from({ length: qty }, (_, i) => {
      const suffix =
        numbering === "alpha" ? String.fromCharCode(64 + start + i) : String(start + i);
      return `${capitalizeNoun(effectiveNoun)} ${suffix}`;
    });
  }, [qty, start, numbering, effectiveNoun]);

  const previewSample = labels.slice(0, 4).join(" · ") + (labels.length > 4 ? ` … ${labels[labels.length - 1]}` : "");

  const canCreate = qty >= 1 && qty <= 60 && cap >= 1 && Number(priceSoles) >= 0;

  const handleCreate = () => {
    if (!canCreate) return;
    const noun = effectiveNoun.toLowerCase();
    const rows: TicketRow[] = labels.map((label) => ({
      rowKey: uid(),
      name: label,
      kind: "box",
      priceSoles: String(priceSoles),
      capacity: String(cap),
      boxLabel: label,
      zone: zone.trim(),
      unitNoun: noun,
      saleEndsAt: "",
    }));
    onCreate(rows);
  };

  return (
    <>
      <motion.div
        key="bbd"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        key="bbs"
        role="dialog"
        aria-modal="true"
        aria-label="Crear boxes en lote"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 360, mass: 0.8 }}
        className="fixed inset-x-0 bottom-0 z-[111] mx-auto flex max-h-[92dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] border-t border-cart-line-strong bg-cart-bg-elev shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.7)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-cart-line px-5 py-4">
          <div>
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cart-accent">
              Boxes en lote
            </div>
            <h3 className="mt-0.5 font-sans text-[19px] font-semibold tracking-[-0.02em]">
              Crear varios a la vez
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-cart-ink-3 transition hover:bg-white/5 hover:text-white"
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* 1 — Zona */}
          <BulkStep number={1} title="Zona del venue">
            <div className="flex flex-col gap-2">
              <input
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ej: Boxes Premium 1er Piso"
                list="bulk-zones"
                maxLength={60}
                className="w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-cart-ink-4 focus:border-cart-accent"
              />
              <datalist id="bulk-zones">
                {knownZones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
              {knownZones.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {knownZones.map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => setZone(z)}
                      className={
                        "rounded-full px-2.5 py-1 text-[11.5px] transition " +
                        (zone === z
                          ? "bg-cart-accent text-cart-bg"
                          : "border border-cart-line text-cart-ink-2 hover:border-white/40")
                      }
                    >
                      {z}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[10.5px] text-cart-ink-4">
                Agrupa los boxes en el plano del comprador. Opcional pero recomendado.
              </p>
            </div>
          </BulkStep>

          {/* 2 — Tipo (noun) */}
          <BulkStep number={2} title="¿Cómo les llamas?">
            <div className="flex flex-wrap gap-1.5">
              {NOUN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setNounPreset(p.id)}
                  className={
                    "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition " +
                    (nounPreset === p.id
                      ? "bg-cart-accent text-cart-bg"
                      : "border border-cart-line bg-cart-bg-elev-2 text-cart-ink-2 hover:border-white/40 hover:text-white")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
            {nounPreset === "custom" && (
              <input
                value={customNoun}
                onChange={(e) => setCustomNoun(e.target.value)}
                placeholder="Ej: Lounge, Espacio, Suite…"
                maxLength={24}
                className="mt-2 w-full rounded-xl border border-cart-line bg-cart-bg-elev-2 px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-cart-ink-4 focus:border-cart-accent"
              />
            )}
            <p className="mt-2 text-[10.5px] text-cart-ink-4">
              El comprador verá: <span className="text-cart-ink-2">«Cada {effectiveNoun.toLowerCase()} para X personas»</span>
            </p>
          </BulkStep>

          {/* 3 — Numeración */}
          <BulkStep number={3} title="Numeración">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setNumbering("num")}
                className={
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition " +
                  (numbering === "num"
                    ? "bg-cart-accent text-cart-bg"
                    : "border border-cart-line bg-cart-bg-elev-2 text-cart-ink-2 hover:border-white/40 hover:text-white")
                }
              >
                1, 2, 3…
              </button>
              <button
                type="button"
                onClick={() => setNumbering("alpha")}
                className={
                  "rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition " +
                  (numbering === "alpha"
                    ? "bg-cart-accent text-cart-bg"
                    : "border border-cart-line bg-cart-bg-elev-2 text-cart-ink-2 hover:border-white/40 hover:text-white")
                }
              >
                A, B, C…
              </button>
            </div>
          </BulkStep>

          {/* 4 — Cantidad / cupo / precio */}
          <BulkStep number={4} title="Configuración">
            <div className="grid grid-cols-3 gap-2">
              <BulkNumberField
                label="Cantidad"
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={60}
              />
              <BulkNumberField
                label="Cupo c/u"
                value={capacity}
                onChange={setCapacity}
                min={1}
                max={50}
              />
              <BulkNumberField
                label="Precio S/"
                value={priceSoles}
                onChange={setPriceSoles}
                min={0}
                max={50000}
              />
            </div>
            <div className="mt-2">
              {numbering === "alpha" ? (
                <label className="flex flex-col gap-1 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-2.5 py-2">
                  <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
                    Empezar en
                  </span>
                  <input
                    value={startLetter}
                    maxLength={1}
                    onChange={(e) => {
                      const l = e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
                      if (l) setStartLetter(l);
                    }}
                    className="w-full bg-transparent text-[16px] font-semibold tracking-[-0.01em] text-white outline-none uppercase"
                  />
                </label>
              ) : (
                <BulkNumberField
                  label="Empezar desde"
                  value={startNumber}
                  onChange={setStartNumber}
                  min={1}
                  max={99}
                />
              )}
            </div>
          </BulkStep>

          {/* Preview */}
          <div className="mt-2 rounded-2xl border border-dashed border-cart-line bg-cart-bg-elev-2 px-3.5 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Vista previa
            </div>
            <div className="mt-1.5 font-mono text-[12.5px] leading-relaxed text-white">
              {qty > 0 ? previewSample : "—"}
            </div>
          </div>
        </div>

        <div
          className="shrink-0 border-t border-cart-line bg-cart-bg-elev px-5 pt-3"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 14px)" }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2.5 text-[13.5px] font-medium text-cart-ink-2 transition hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate}
              className="flex-1 rounded-full bg-cart-accent py-3 text-[14px] font-semibold text-cart-bg shadow-[0_8px_24px_-6px_var(--color-cart-accent-glow)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-cart-bg-elev-2 disabled:text-cart-ink-3 disabled:shadow-none"
            >
              {canCreate ? `Crear ${qty} boxes` : "Completa los campos"}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// Selector compacto para elegir cómo el organizador llama a la unidad
// reservable (box, mesa, lounge u otro). Se muestra dentro de cada row de
// kind=box en el editor de tickets.
function UnitNounPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const presets = ["box", "mesa", "lounge"];
  const lower = value.trim().toLowerCase();
  const isPreset = presets.includes(lower);
  const isCustom = lower.length > 0 && !isPreset;
  const [showCustom, setShowCustom] = useState(isCustom);

  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-xl bg-cart-bg-elev px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        Tipo
      </span>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = lower === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => {
                onChange(p);
                setShowCustom(false);
              }}
              className={
                "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition " +
                (active
                  ? "bg-cart-accent text-cart-bg"
                  : "border border-cart-line text-cart-ink-2 hover:border-white/40")
              }
            >
              {p[0].toUpperCase() + p.slice(1)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setShowCustom(true);
            if (isPreset) onChange("");
          }}
          className={
            "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition " +
            (isCustom || showCustom
              ? "bg-cart-accent text-cart-bg"
              : "border border-cart-line text-cart-ink-2 hover:border-white/40")
          }
        >
          Otro
        </button>
      </div>
      {(showCustom || isCustom) && (
        <input
          value={isPreset ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: Suite, Cabaña…"
          maxLength={24}
          className="mt-1 w-full bg-transparent text-[13px] text-white outline-none placeholder:text-cart-ink-4"
        />
      )}
    </div>
  );
}

function BulkStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid size-5 place-items-center rounded-full bg-cart-accent/20 text-[10.5px] font-bold text-cart-accent">
          {number}
        </span>
        <h4 className="text-[13px] font-semibold tracking-[-0.005em] text-white">{title}</h4>
      </div>
      <div>{children}</div>
    </div>
  );
}

function BulkNumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 rounded-xl border border-cart-line bg-cart-bg-elev-2 px-2.5 py-2">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
        {label}
      </span>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const clean = e.target.value.replace(/[^0-9]/g, "");
          if (clean === "") return onChange("");
          const n = Number(clean);
          if (n > max) return onChange(String(max));
          onChange(clean);
        }}
        onBlur={() => {
          const n = Number(value);
          if (!n || n < min) onChange(String(min));
        }}
        className="w-full bg-transparent text-[16px] font-semibold tracking-[-0.01em] text-white outline-none"
      />
      {hint && <span className="text-[9.5px] text-cart-ink-4">{hint}</span>}
    </label>
  );
}
