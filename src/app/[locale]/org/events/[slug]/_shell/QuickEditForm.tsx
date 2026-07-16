"use client";

import { useRef, useState } from "react";
import { Money } from "@/lib/_shared/money";
import { useUpdateEvent } from "@/lib/events/hooks/useUpdateEvent";
import { useUpdateTicketType } from "@/lib/events/hooks/useTicketTypes";
import { useSetPromos, type PromoDraft } from "@/lib/events/hooks/usePromos";
import { uploadEventAsset } from "@/lib/events/uploadEventAsset";
import { isoToDateTime } from "@/lib/events/eventDateTime";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { VenueInput, type VenueValue } from "@/components/ui/VenueInput";
import { MIN_PAID_TICKET_PRICE_CENTS } from "@/lib/tickets/serviceFee";
import { CATEGORIES } from "@/app/[locale]/_home/categories";
import { CustomFieldsEditor } from "../../_components/CustomFieldsEditor";
import type { CustomField } from "@/lib/events/customFields";
import type { Event, EventCategory, FeeMode, TicketType, Promo } from "@/server/events/domain/Event";

// Versión reducida de EventComposer en modo edit, para eventos creados con la
// versión rápida (un solo tipo de entrada, sin box). Mismos valores, menos
// campos — ver quick-create/page.tsx (mismo espíritu). Incluye Promociones
// (2x1/3x2): es simple de mostrar aunque el resto del formulario sea mínimo.

const PROMO_COPY: Record<"2x1" | "3x2", string> = {
  "2x1": "Llevan 2, pagan 1",
  "3x2": "Llevan 3, pagan 2",
};

export function QuickEditForm({
  slug,
  event,
  ticketType,
  promos,
  onClose,
  onSwitchToFull,
}: {
  slug: string;
  event: Event;
  ticketType: TicketType & { kind: "general" };
  promos: Promo[];
  onClose: () => void;
  onSwitchToFull: () => void;
}) {
  const updateEvent = useUpdateEvent(slug);
  const updateTicketType = useUpdateTicketType(slug);
  const setPromos = useSetPromos(slug);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const seededDateTime = isoToDateTime(event.startsAt, event.timezone);

  const [title, setTitle] = useState(event.title);
  const [category, setCategory] = useState<EventCategory>(event.category ?? "fiestas");
  const [feeMode, setFeeMode] = useState<FeeMode>(event.feeMode);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(event.coverUrl);
  const [date, setDate] = useState(seededDateTime.date);
  const [time, setTime] = useState(seededDateTime.time);
  const [venue, setVenue] = useState<VenueValue>({
    name: event.venue ?? "",
    lat: event.venueLat,
    lng: event.venueLng,
    url: event.venueUrl,
    source: event.venueSource ?? "manual",
  });
  const [priceSoles, setPriceSoles] = useState(String(Money.toSoles(ticketType.priceCents)));
  const [capacity, setCapacity] = useState(String(ticketType.stock));
  const [promo2x1, setPromo2x1] = useState(promos.some((p) => p.kind === "2x1"));
  const [promo3x2, setPromo3x2] = useState(promos.some((p) => p.kind === "3x2"));
  const [customFields, setCustomFields] = useState<CustomField[]>(event.customFields);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const priceCents = Money.toCents(priceSoles);
  const capacityNum = Number(capacity);
  const priceValid =
    priceSoles.trim() === "" ? false : priceCents === 0 || priceCents >= MIN_PAID_TICKET_PRICE_CENTS;
  const capacityValid = Number.isInteger(capacityNum) && capacityNum > 0;
  // Espejo del refine de customFieldSchema (zod): sin esto, una pregunta a
  // medio llenar pasaría el "Guardar cambios" y recién fallaría en el server.
  const customFieldsValid = customFields.every(
    (f) =>
      f.label.trim().length > 0 &&
      (f.type !== "single_select" && f.type !== "multiple_select"
        ? true
        : (f.options?.length ?? 0) >= 2),
  );
  const ready =
    title.trim().length > 0 &&
    date.length > 0 &&
    time.length > 0 &&
    venue.name.trim().length > 0 &&
    priceValid &&
    capacityValid &&
    customFieldsValid;

  const isPending = updateEvent.isPending || updateTicketType.isPending || setPromos.isPending;

  const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!ready || isPending) return;
    setSubmitError(null);
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const nextVenueName = venue.name.trim() || null;

      const patch: Record<string, unknown> = {};
      if (title.trim() !== event.title) patch.title = title.trim();
      if (category !== (event.category ?? null)) patch.category = category;
      if (feeMode !== event.feeMode) patch.feeMode = feeMode;
      if (startsAt !== event.startsAt) patch.startsAt = startsAt;
      if (nextVenueName !== event.venue) patch.venue = nextVenueName;
      if (venue.lat !== event.venueLat) patch.venueLat = venue.lat;
      if (venue.lng !== event.venueLng) patch.venueLng = venue.lng;
      if (venue.url !== event.venueUrl) patch.venueUrl = venue.url;
      if (venue.source !== (event.venueSource ?? "manual")) patch.venueSource = venue.source;
      if (JSON.stringify(customFields) !== JSON.stringify(event.customFields)) {
        patch.customFields = customFields;
      }

      const ttPatch: Record<string, unknown> = {};
      if (priceCents !== ticketType.priceCents) ttPatch.priceCents = priceCents;
      if (capacityNum !== ticketType.stock) ttPatch.capacity = capacityNum;

      const promoBefore = new Set(promos.map((p) => p.kind));
      const promoAfter = new Set<"2x1" | "3x2">([
        ...(promo2x1 ? (["2x1"] as const) : []),
        ...(promo3x2 ? (["3x2"] as const) : []),
      ]);
      const promosChanged =
        promoBefore.size !== promoAfter.size || [...promoBefore].some((k) => !promoAfter.has(k as "2x1" | "3x2"));

      // Las 3 mutaciones tocan tablas distintas (events / ticket_types /
      // ticket_promos) y no dependen entre sí — en paralelo en vez de en
      // serie para no pagar 3 round-trips seguidos por un guardado.
      await Promise.all([
        Object.keys(patch).length > 0 ? updateEvent.mutateAsync(patch) : null,
        Object.keys(ttPatch).length > 0
          ? updateTicketType.mutateAsync({ id: ticketType.id, input: ttPatch })
          : null,
        promosChanged ? setPromos.mutateAsync([...promoAfter].map((kind) => ({ ticketTypeId: ticketType.id, kind, endsAt: null }) as PromoDraft)) : null,
      ]);

      if (coverFile) {
        uploadEventAsset(coverFile, { slugHint: title, kind: "cover" })
          .then((coverUrl) =>
            fetch(`/api/events/${slug}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ coverUrl }),
            }),
          )
          .catch(() => undefined);
      }

      onClose();
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-cart-bg">
          {coverPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #1a1024 0%, #7c3aed 60%, #3b0f6b 100%)" }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-full border border-cart-line px-3 py-1.5 text-[12px] font-medium text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
        >
          Cambiar portada
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPickCover} className="sr-only" />
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Nombre del evento
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1.5 w-full bg-transparent font-sans text-[19px] font-semibold leading-tight tracking-[-0.02em] text-cart-ink outline-none placeholder:text-cart-ink-4"
        />
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
            Tipo de evento
          </span>
          {CATEGORIES.map(({ id, label, color }) => {
            const active = category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors ${
                  active ? "" : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-cart-ink"
                }`}
                style={active ? { borderColor: color, background: `${color}1f`, color: "var(--color-cart-ink)" } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-3">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Fecha</span>
            <DatePicker value={date} onChange={setDate} placeholder="Elegir día" />
          </div>
          <div className="mt-3 flex flex-col gap-1.5 sm:mt-0 sm:gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Hora</span>
            <TimePicker value={time} onChange={setTime} placeholder="Elegir hora" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <div className="flex flex-col gap-1.5 sm:gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Lugar</span>
          <VenueInput value={venue} onChange={setVenue} placeholder="Pega Google Maps o escribe el lugar" />
        </div>
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
          Comisión de Pasape
        </span>
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
                    : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-cart-ink"
                }`}
              >
                <span className={`text-[12.5px] font-medium ${active ? "text-cart-ink" : ""}`}>{label}</span>
                <span className="text-[11px] text-cart-ink-3">{hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Precio (S/)</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={priceSoles}
              onChange={(e) => setPriceSoles(e.target.value)}
              className="w-full bg-transparent text-[16px] text-cart-ink outline-none placeholder:text-cart-ink-4"
            />
            {priceSoles.trim() !== "" && !priceValid && (
              <p className="text-[11px] text-rose-600">
                Mínimo {Money.format(MIN_PAID_TICKET_PRICE_CENTS)} o S/0 si es gratis.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Cupos</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full bg-transparent text-[16px] text-cart-ink outline-none placeholder:text-cart-ink-4"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">Promociones</span>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPromo2x1((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              promo2x1
                ? "border-cart-accent bg-cart-accent/10 text-cart-accent"
                : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-cart-ink"
            }`}
          >
            {PROMO_COPY["2x1"]}
          </button>
          <button
            type="button"
            onClick={() => setPromo3x2((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              promo3x2
                ? "border-cart-accent bg-cart-accent/10 text-cart-accent"
                : "border-cart-line text-cart-ink-3 hover:border-cart-line-strong hover:text-cart-ink"
            }`}
          >
            {PROMO_COPY["3x2"]}
          </button>
        </div>
      </div>

      <CustomFieldsEditor fields={customFields} onChange={setCustomFields} />

      {submitError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-600">
          No pudimos guardar los cambios. Intenta de nuevo.
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSwitchToFull}
          className="text-[12.5px] font-medium text-cart-ink-3 underline decoration-cart-ink-4 underline-offset-2 transition hover:text-cart-ink-2"
        >
          Ver opciones completas
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!ready || isPending}
          className={
            "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[14px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 " +
            (!ready
              ? "border border-amber-500/60 bg-amber-500/15 text-amber-700"
              : "bg-cart-accent shadow-[0_14px_36px_-8px_var(--color-cart-accent-glow-strong)] hover:-translate-y-px")
          }
        >
          {isPending ? "Guardando…" : !ready ? "Falta completar" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
