"use client";

import { useRef, useState } from "react";
import { useRouter, Link } from "@/i18n/navigation";
import { Money } from "@/lib/_shared/money";
import { useCreateEvent } from "@/lib/events/hooks/useCreateEvent";
import { uploadEventAsset } from "@/lib/events/uploadEventAsset";
import { setComposerModePreference } from "@/lib/events/composerModePreference";
import { DatePicker, TimePicker } from "@/components/ui/DateTimePicker";
import { VenueInput, type VenueValue } from "@/components/ui/VenueInput";
import { MIN_PAID_TICKET_PRICE_CENTS } from "@/lib/tickets/serviceFee";
import { CATEGORIES } from "@/app/[locale]/_home/categories";
import type { EventCategory, FeeMode } from "@/server/events/domain/Event";

// Flujo de creación rápida para artistas/bandas/DJs independientes — ver
// design doc "Creación de evento en segundos para artistas independientes"
// (office-hours 2026-07-12). Reusa el mismo template visual del composer
// completo (OrgShell + layout de dos columnas, misma tarjeta de portada sin
// editor de paleta) para que se sienta parte del mismo producto — pero con
// muchos menos campos: sin promotores, sin distribución de local, sin tope
// por persona, sin comisión configurable, un solo tipo de entrada.
//
// Publicar SIEMPRE envía a revisión de inmediato (sin toggle borrador/publicar).
// La imagen NO bloquea publicar: se sube en background tras crear el evento.

const DEFAULT_CAPACITY = 50;
const COVER_GRADIENT = "linear-gradient(135deg, #1a1024 0%, #7c3aed 60%, #3b0f6b 100%)";

export default function QuickCreateEventPage() {
  return <QuickCreateForm />;
}

function QuickCreateForm() {
  const router = useRouter();
  const create = useCreateEvent();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("fiestas");
  const [feeMode, setFeeMode] = useState<FeeMode>("buyer_pays_extra");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [venue, setVenue] = useState<VenueValue>({
    name: "",
    lat: null,
    lng: null,
    url: null,
    source: "manual",
  });
  const [priceSoles, setPriceSoles] = useState("");
  const [capacity, setCapacity] = useState(String(DEFAULT_CAPACITY));
  const [submitError, setSubmitError] = useState<string | null>(null);

  const priceCents = Money.toCents(priceSoles);
  const capacityNum = Number(capacity);
  const priceValid =
    priceSoles.trim() === "" ? false : priceCents === 0 || priceCents >= MIN_PAID_TICKET_PRICE_CENTS;
  const capacityValid = Number.isInteger(capacityNum) && capacityNum > 0;
  const ready =
    title.trim().length > 0 &&
    date.length > 0 &&
    time.length > 0 &&
    venue.name.trim().length > 0 &&
    priceValid &&
    capacityValid;

  const onPickCover = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = async () => {
    if (!ready || create.isPending) return;
    setSubmitError(null);
    const startsAt = new Date(`${date}T${time}:00`).toISOString();
    try {
      const ev = await create.mutateAsync({
        title: title.trim(),
        category,
        feeMode,
        venue: venue.name.trim(),
        venueLat: venue.lat,
        venueLng: venue.lng,
        venueUrl: venue.url,
        venueSource: venue.source,
        startsAt,
        timezone: "America/Lima",
        ticketTypes: [
          { name: "Entrada general", kind: "general", priceCents, capacity: capacityNum },
        ],
        transfersEnabled: true,
        transferRequiresKyc: false,
      });
      if (!ev.slug) throw new Error("create_failed");

      let finalStatus: "draft" | "pending_review" = "draft";
      try {
        const res = await fetch(`/api/events/${ev.slug}/publish`, { method: "POST" });
        if (res.ok) finalStatus = "pending_review";
      } catch {
        // Si falla, el evento queda en draft — igual redirigimos.
      }

      if (coverFile) {
        uploadEventAsset(coverFile, { slugHint: title, kind: "cover" })
          .then((coverUrl) =>
            fetch(`/api/events/${ev.slug}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ coverUrl }),
            }),
          )
          .catch(() => undefined);
      }

      setComposerModePreference("simple");
      router.push(`/org/events/new/success?slug=${ev.slug}&status=${finalStatus}` as never);
    } catch (e) {
      if ((e as Error).message === "no_active_org") {
        router.push("/auth/onboarding?intent=organizer" as never);
        return;
      }
      setSubmitError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] pb-32 lg:pb-12">
      <div className="mb-6 flex items-center justify-between gap-3 lg:mb-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/org/events" as never)}
            aria-label="Cancelar"
            className="grid size-9 place-items-center rounded-full border border-cart-line bg-cart-bg-elev text-cart-ink-2 transition hover:border-cart-line-strong hover:text-cart-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="font-sans text-[22px] font-semibold leading-tight tracking-[-0.02em] lg:text-[26px]">
            Publicar tu evento
          </h1>
        </div>
        <Link
          href={"/org/events/new" as never}
          onClick={() => setComposerModePreference("full")}
          className="text-[12.5px] font-medium text-cart-ink-3 underline decoration-cart-ink-4 underline-offset-2 transition hover:text-cart-ink-2"
        >
          Ver opciones completas
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-10">
        {/* Portada — mismo tratamiento visual del composer completo, sin
            editor de paleta de marca (decidido en /plan-eng-review). */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="relative aspect-4/5 w-full overflow-hidden rounded-[28px] border border-cart-line-strong bg-cart-bg-elev">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="absolute inset-0 size-full object-cover" />
            ) : (
              <div className="absolute inset-0" style={{ background: COVER_GRADIENT }} />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="font-sans text-[28px] font-semibold leading-[1.04] tracking-tight text-white sm:text-[32px] lg:text-[36px]">
                {title || "Tu evento"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1.5 text-[12.5px] font-medium text-white backdrop-blur transition hover:bg-black/65"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 6a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M4 13.5l3.5-3.5 2.5 2.5 3-3L16 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Subir portada
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickCover}
              className="sr-only"
            />
          </div>
        </div>

        {/* Formulario */}
        <div className="flex flex-col gap-3.5">
          <div className="rounded-2xl border border-cart-line bg-cart-bg-elev px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cart-ink-3">
              Nombre del evento
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿Cómo se llama tu evento?"
              autoFocus
              className="mt-1.5 w-full bg-transparent font-sans text-[22px] font-semibold leading-tight tracking-[-0.02em] text-cart-ink outline-none placeholder:text-cart-ink-4 lg:text-[26px]"
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
              <VenueInput
                value={venue}
                onChange={setVenue}
                placeholder="Pega Google Maps o escribe el lugar"
              />
            </div>
          </div>

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
                  placeholder="0"
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

          {submitError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-600">
              No pudimos publicar tu evento. Intenta de nuevo.
            </div>
          )}

          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={create.isPending}
              className={
                "inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-60 " +
                (!ready
                  ? "border border-amber-500/60 bg-amber-500/15 text-amber-700"
                  : "bg-cart-accent shadow-[0_14px_36px_-8px_var(--color-cart-accent-glow-strong)] hover:-translate-y-px")
              }
            >
              {create.isPending && (
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" className="animate-spin">
                  <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" opacity="0.3" />
                  <path d="M12 7a5 5 0 00-5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
              {create.isPending ? "Publicando…" : !ready ? "Falta completar" : "Publicar evento"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
