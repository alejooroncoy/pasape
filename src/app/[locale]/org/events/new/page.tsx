"use client";

import { useMemo, useRef, useState } from "react";
import {
  Avatar,
  BackBtn,
  Btn,
  C,
  CloseBtn,
  Dot,
  FONT_DISPLAY,
  FONT_MONO,
  Field,
  Phone,
  StepDots,
} from "@/components/design";
import { useRouter } from "@/i18n/navigation";
import { useCreateEvent } from "@/lib/events/hooks/useCreateEvent";

// ---------- tipos locales del wizard ----------
type TicketKind = "general" | "vip" | "box";

type TicketRow = {
  id: string;
  name: string;
  priceSoles: string; // string para input controlado
  capacity: string;
  kind: TicketKind;
  sub?: string;
};

// TODO: cuando exista el endpoint
type OrganizerRow = {
  id: string;
  name: string;
  whatsapp: string;
};

// TODO: cuando exista el endpoint
type PromoterRow = {
  id: string;
  name: string;
  whatsapp: string;
  commissionPct: number;
};

type Step = 0 | 1 | 2 | 3 | 4;

const uid = () => Math.random().toString(36).slice(2, 9);

const toCents = (s: string) => Math.round(Number(s || "0") * 100);

const PASO_LABEL = ["PASO 1 DE 5", "PASO 2 DE 5", "PASO 3 DE 5", "PASO 4 DE 5", "PASO 5 DE 5 · REVISIÓN"];

export default function NewEventWizardPage() {
  const router = useRouter();
  const create = useCreateEvent();

  const [step, setStep] = useState<Step>(0);

  // step 0
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:MM
  const [venue, setVenue] = useState("");

  // step 1
  const [tickets, setTickets] = useState<TicketRow[]>([
    { id: uid(), name: "General", priceSoles: "30", capacity: "200", kind: "general" },
  ]);

  // fotos
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  // step 2 & 3 (no se mandan al backend aún)
  const [organizers, setOrganizers] = useState<OrganizerRow[]>([]);
  const [promoters, setPromoters] = useState<PromoterRow[]>([]);

  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [addPromoOpen, setAddPromoOpen] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
    e.target.value = "";
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverPreview(null);
  };

  const handleExtraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setExtraFiles((prev) => [...prev, ...files]);
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setExtraPreviews((prev) => [...prev, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removeExtra = (i: number) => {
    setExtraFiles((prev) => prev.filter((_, idx) => idx !== i));
    setExtraPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const totals = useMemo(() => {
    const qty = tickets.reduce((a, t) => a + Number(t.capacity || 0), 0);
    const max = tickets.reduce(
      (a, t) => a + Number(t.capacity || 0) * Number(t.priceSoles || 0),
      0,
    );
    return { qty, max };
  }, [tickets]);

  const formattedDate = useMemo(() => {
    if (!date) return "—";
    try {
      const d = new Date(date + "T00:00:00");
      return d
        .toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" })
        .replace(".", "");
    } catch {
      return date;
    }
  }, [date]);

  // ---------- submit ----------
  const handlePublish = async () => {
    setSubmitError(null);
    try {
      if (!title || !date || !time) {
        setSubmitError("Completá nombre, fecha y hora.");
        return;
      }
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      const ticketTypes = tickets
        .filter((t) => t.name && Number(t.capacity) > 0)
        .map((t) => ({
          name: t.name,
          kind: t.kind,
          priceCents: toCents(t.priceSoles),
          capacity: Number(t.capacity),
        }));
      const ev = await create.mutateAsync({
        title,
        venue: venue || null,
        startsAt,
        timezone: "America/Lima",
        ticketTypes,
        transfersEnabled: true,
        transferRequiresKyc: false,
      });
      // TODO: cuando exista el endpoint, mandar organizers y promoters
      router.push(`/org/events/new/success?slug=${ev.slug ?? ""}`);
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  };

  // ---------- header ----------
  const header = (
    <div
      style={{
        padding: "6px 22px 0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {step === 0 ? <CloseBtn href="/org" /> : <BackBtn />}
      <StepDots step={step} of={5} />
      {step === 0 ? <div style={{ width: 38 }} /> : <CloseBtn href="/org" />}
    </div>
  );

  // ---------- pasos ----------
  return (
    <Phone>
      <style>{`@keyframes pulse {0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
      {header}

      {step === 0 && (
        <div style={{ padding: "22px 22px 140px" }}>
          <div style={pasoLabelStyle}>{PASO_LABEL[0]}</div>
          <div style={titleStyle}>
            Lo básico
            <br />
            de tu evento
          </div>
          <Field
            label="Nombre del evento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reverb x La Selva"
            active={title.length > 0}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              active={!!date}
            />
            <Field
              label="Hora"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              active={!!time}
            />
          </div>
          <Field
            label="Lugar"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            placeholder="Barranco, Lima"
            active={venue.length > 0}
          />
          {/* ── Foto principal ── */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, letterSpacing: "0.04em" }}>
              FOTO DEL FLYER
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleCoverChange}
            />
            {coverPreview ? (
              <div style={{ position: "relative" }}>
                <img
                  src={coverPreview}
                  alt="Flyer"
                  style={{
                    width: "100%",
                    height: 160,
                    objectFit: "cover",
                    borderRadius: 18,
                    display: "block",
                  }}
                />
                <button
                  type="button"
                  onClick={removeCover}
                  aria-label="Quitar foto"
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: 0,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    fontSize: 16,
                    lineHeight: "28px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M2 2l10 10M12 2L2 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: 0,
                    background: "rgba(0,0,0,0.55)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                style={{
                  width: "100%",
                  height: 90,
                  borderRadius: 18,
                  border: 0,
                  background: "rgba(255,255,255,0.02)",
                  boxShadow: "0 0 0 1.5px rgba(255,255,255,0.18) inset",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: C.dim,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <PlusIcon /> Subir foto del flyer
              </button>
            )}
          </div>

          {/* ── Fotos secundarias ── */}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 12, color: C.dim, letterSpacing: "0.04em" }}>
                FOTOS DEL LUGAR
              </span>
              <OptionalChip />
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 10, lineHeight: 1.4 }}>
              Escenario, distribución de boxes, zonas…
            </div>
            <input
              ref={extraInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={handleExtraChange}
            />
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
              {extraPreviews.map((url, i) => (
                <div
                  key={url}
                  style={{ position: "relative", flexShrink: 0 }}
                >
                  <img
                    src={url}
                    alt={`Extra ${i + 1}`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "cover",
                      borderRadius: 14,
                      display: "block",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeExtra(i)}
                    aria-label="Quitar"
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      border: 0,
                      background: "rgba(0,0,0,0.6)",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10">
                      <path d="M1 1l8 8M9 1L1 9" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => extraInputRef.current?.click()}
                style={{
                  flexShrink: 0,
                  width: 80,
                  height: 80,
                  borderRadius: 14,
                  border: 0,
                  background: "rgba(255,255,255,0.02)",
                  boxShadow: "0 0 0 1.5px rgba(255,255,255,0.12) inset",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: C.dim,
                }}
              >
                <PlusIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ padding: "22px 22px 140px" }}>
          <div style={pasoLabelStyle}>{PASO_LABEL[1]}</div>
          <div style={{ ...titleStyle, marginBottom: 18 }}>
            ¿Qué tipos
            <br />
            de entrada vendes?
          </div>

          {tickets.map((t, i) => (
            <TicketEditorRow
              key={t.id}
              row={t}
              onChange={(next) =>
                setTickets((prev) => prev.map((p, idx) => (idx === i ? next : p)))
              }
              onRemove={
                tickets.length > 1
                  ? () => setTickets((prev) => prev.filter((_, idx) => idx !== i))
                  : undefined
              }
            />
          ))}

          <button
            type="button"
            onClick={() =>
              setTickets((prev) => [
                ...prev,
                { id: uid(), name: "", priceSoles: "", capacity: "", kind: "general" },
              ])
            }
            style={{
              marginTop: 4,
              width: "100%",
              height: 56,
              borderRadius: 16,
              border: 0,
              background: "transparent",
              boxShadow: `0 0 0 1.5px ${C.purple} inset`,
              color: C.purple,
              fontFamily: FONT_DISPLAY,
              fontWeight: 600,
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Agregar otro tipo
          </button>

          <div
            style={{
              marginTop: 18,
              padding: "14px 16px",
              borderRadius: 14,
              background: C.bg2,
              boxShadow: `0 0 0 1px ${C.line} inset`,
            }}
          >
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>Total disponible</div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.03em",
              }}
            >
              {totals.qty} entradas · S/ {totals.max.toLocaleString("es-PE")} max
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ padding: "22px 22px 160px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div style={pasoLabelStyle}>{PASO_LABEL[2]}</div>
            <OptionalChip />
          </div>
          <div style={titleStyle}>
            ¿Alguien más
            <br />
            maneja el evento?
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 1.4 }}>
            Los co-organizadores ven los mismos números que tú y pueden editar el evento.{" "}
            <strong style={{ color: "#fff" }}>Puedes agregarlos después.</strong>
          </div>

          <div style={{ marginTop: 22 }}>
            {organizers.map((o) => (
              <PersonRow
                key={o.id}
                name={o.name}
                wsp={o.whatsapp}
                role="organizador"
                onRemove={() =>
                  setOrganizers((prev) => prev.filter((p) => p.id !== o.id))
                }
              />
            ))}
            <AddPersonBtn label="Agregar co-organizador" onClick={() => setAddOrgOpen(true)} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ padding: "22px 22px 160px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div style={pasoLabelStyle}>{PASO_LABEL[3]}</div>
            <OptionalChip />
          </div>
          <div style={titleStyle}>
            ¿Quién te ayuda
            <br />
            a vender?
          </div>
          <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 1.4 }}>
            Cada promotor recibe su link único por WhatsApp y gana comisión.{" "}
            <strong style={{ color: "#fff" }}>Puedes sumar o quitar cuando quieras.</strong>
          </div>

          <div style={{ marginTop: 18 }}>
            {promoters.map((p) => (
              <PersonRow
                key={p.id}
                name={p.name}
                wsp={p.whatsapp}
                role={`${p.commissionPct}% comisión`}
                onRemove={() =>
                  setPromoters((prev) => prev.filter((x) => x.id !== p.id))
                }
              />
            ))}
            <AddPersonBtn label="Agregar promotor" onClick={() => setAddPromoOpen(true)} />
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={{ padding: "22px 22px 140px" }}>
          <div style={pasoLabelStyle}>{PASO_LABEL[4]}</div>
          <div style={{ ...titleStyle, marginBottom: 18 }}>
            Una última
            <br />
            mirada.
          </div>

          {/* Preview card */}
          <div
            style={{
              borderRadius: 18,
              padding: 14,
              marginBottom: 14,
              background: "linear-gradient(150deg, #4B1F9A 0%, #7C3AED 50%, #FF4D5E 110%)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 28,
              }}
            >
              <div style={previewMetaStyle}>
                {formattedDate.toUpperCase()} · {time || "--:--"}
              </div>
              <div style={previewMetaStyle}>{(venue || "").toUpperCase()}</div>
            </div>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
              }}
            >
              {title || "Sin nombre"}
            </div>
          </div>

          <SummaryRow
            label="Fotos"
            value={
              coverFile
                ? `Flyer${extraFiles.length ? ` · ${extraFiles.length} foto${extraFiles.length === 1 ? "" : "s"} del lugar` : ""}`
                : "Sin foto · puedes subirla después"
            }
            onEdit={() => setStep(0)}
          />
          <SummaryRow
            label="Entradas"
            value={`${tickets.length} tipo${tickets.length === 1 ? "" : "s"} · ${totals.qty} disponibles`}
            onEdit={() => setStep(1)}
          />
          <SummaryRow
            label="Co-organizadores"
            value={
              organizers.length
                ? `${organizers.length} · puedes sumar más después`
                : "Ninguno · puedes sumarlos después"
            }
            onEdit={() => setStep(2)}
          />
          <SummaryRow
            label="Promotores"
            value={
              promoters.length
                ? `${promoters.length} personas · ${avgCommission(promoters)}% promedio`
                : "Ninguno"
            }
            onEdit={() => setStep(3)}
          />

          {submitError && (
            <div style={{ marginTop: 12, color: C.red, fontSize: 13 }}>{submitError}</div>
          )}
        </div>
      )}

      {/* Bottom bar */}
      <div style={{ position: "fixed", bottom: 32, left: 0, right: 0, padding: "0 22px", maxWidth: 390, margin: "0 auto" }}>
        {step === 0 && (
          <Btn
            onClick={() => setStep(1)}
            disabled={!title || !date || !time}
          >
            Siguiente
          </Btn>
        )}
        {step === 1 && (
          <Btn
            onClick={() => setStep(2)}
            disabled={tickets.every((t) => !t.name || !t.capacity)}
          >
            Siguiente
          </Btn>
        )}
        {step === 2 && (
          <div style={{ display: "flex", gap: 10 }}>
            <Btn kind="secondary" onClick={() => setStep(3)}>
              Saltar
            </Btn>
            <Btn onClick={() => setStep(3)}>Siguiente</Btn>
          </div>
        )}
        {step === 3 && (
          <div style={{ display: "flex", gap: 10 }}>
            <Btn kind="secondary" onClick={() => setStep(4)}>
              Saltar
            </Btn>
            <Btn onClick={() => setStep(4)}>Siguiente</Btn>
          </div>
        )}
        {step === 4 && (
          <Btn onClick={handlePublish} disabled={create.isPending}>
            {create.isPending ? "Publicando…" : "Publicar evento"}
          </Btn>
        )}
      </div>

      {/* Modals */}
      {addOrgOpen && (
        <AddOrganizerSheet
          onClose={() => setAddOrgOpen(false)}
          onSave={(o) => {
            setOrganizers((prev) => [...prev, o]);
            setAddOrgOpen(false);
          }}
        />
      )}
      {addPromoOpen && (
        <AddPromoterSheet
          onClose={() => setAddPromoOpen(false)}
          onSave={(p) => {
            setPromoters((prev) => [...prev, p]);
            setAddPromoOpen(false);
          }}
        />
      )}
    </Phone>
  );
}

// ============================================================
// Estilos compartidos
// ============================================================
const pasoLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.purple,
  letterSpacing: "0.08em",
  fontWeight: 700,
  marginBottom: 6,
};

const titleStyle: React.CSSProperties = {
  fontFamily: FONT_DISPLAY,
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  lineHeight: 1.05,
  marginBottom: 22,
};

const previewMetaStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  color: "rgba(255,255,255,0.8)",
  fontWeight: 600,
};

// ============================================================
// Sub-componentes locales
// ============================================================
const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path
      d="M9 2v14M2 9h14"
      stroke="rgba(255,255,255,0.5)"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const OptionalChip = () => (
  <div
    style={{
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.06)",
      color: C.dim,
      letterSpacing: "0.04em",
    }}
  >
    OPCIONAL
  </div>
);

function TicketEditorRow({
  row,
  onChange,
  onRemove,
}: {
  row: TicketRow;
  onChange: (next: TicketRow) => void;
  onRemove?: () => void;
}) {
  const isVip = row.kind === "vip";
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        marginBottom: 10,
        background: isVip
          ? "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(124,58,237,0.02))"
          : "rgba(255,255,255,0.03)",
        boxShadow: `0 0 0 1px ${isVip ? C.purpleEdge : C.line} inset`,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 10 }}>
        <input
          value={row.name}
          onChange={(e) => onChange({ ...row, name: e.target.value })}
          placeholder="Nombre (ej: General)"
          style={inlineInputStyle}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Quitar"
            style={{
              background: "transparent",
              border: 0,
              color: C.dim,
              cursor: "pointer",
              padding: 4,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18">
              <path
                d="M5 5l8 8M13 5l-8 8"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
        <div style={smallFieldWrap}>
          <span style={smallPrefix}>S/</span>
          <input
            value={row.priceSoles}
            onChange={(e) => onChange({ ...row, priceSoles: e.target.value })}
            inputMode="decimal"
            placeholder="0"
            style={{ ...inlineInputStyle, fontFamily: FONT_MONO }}
          />
        </div>
        <div style={smallFieldWrap}>
          <span style={smallPrefix}>×</span>
          <input
            value={row.capacity}
            onChange={(e) => onChange({ ...row, capacity: e.target.value })}
            inputMode="numeric"
            placeholder="0"
            style={{ ...inlineInputStyle, fontFamily: FONT_MONO }}
          />
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {(["general", "vip", "box"] as TicketKind[]).map((k) => {
          const on = row.kind === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...row, kind: k })}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 10,
                border: 0,
                background: on ? C.purpleSoft : "rgba(255,255,255,0.04)",
                boxShadow: on
                  ? `0 0 0 1.5px ${C.purple} inset`
                  : `0 0 0 1px ${C.line} inset`,
                color: on ? "#fff" : C.dim,
                fontFamily: FONT_DISPLAY,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              {k}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inlineInputStyle: React.CSSProperties = {
  background: "transparent",
  border: 0,
  outline: "none",
  color: "#fff",
  fontFamily: FONT_DISPLAY,
  fontWeight: 600,
  fontSize: 15,
  width: "100%",
  padding: "8px 10px",
  borderRadius: 10,
  boxShadow: `0 0 0 1px ${C.line} inset`,
};

const smallFieldWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "rgba(255,255,255,0.03)",
  borderRadius: 10,
  padding: "0 8px",
  boxShadow: `0 0 0 1px ${C.line} inset`,
};

const smallPrefix: React.CSSProperties = {
  color: C.dim,
  fontSize: 12,
  fontFamily: FONT_MONO,
};

function PersonRow({
  name,
  wsp,
  role,
  you,
  onRemove,
}: {
  name: string;
  wsp: string;
  role: string;
  you?: boolean;
  onRemove?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        marginBottom: 8,
        background: "rgba(255,255,255,0.03)",
        borderRadius: 14,
        boxShadow: `0 0 0 1px ${C.line} inset`,
      }}
    >
      <Avatar initials={(name[0] ?? "·").toUpperCase()} color={you ? C.purple : "rgba(255,255,255,0.08)"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{name}</span>
          {you && (
            <span
              style={{
                fontSize: 9,
                padding: "1px 6px",
                borderRadius: 999,
                background: C.purpleSoft,
                color: C.purple,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              TÚ
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.dim }}>
          {wsp} · {role}
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar"
          style={{ background: "transparent", border: 0, padding: 4, cursor: "pointer" }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path
              d="M5 5l8 8M13 5l-8 8"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

function AddPersonBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: 0,
        background: "transparent",
        boxShadow: "0 0 0 1.2px rgba(124,58,237,0.5) inset",
        color: C.purple,
        fontWeight: 600,
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> {label}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderRadius: 14,
        marginBottom: 8,
        background: "rgba(255,255,255,0.03)",
        boxShadow: `0 0 0 1px ${C.line} inset`,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: C.dim, letterSpacing: "0.04em" }}>
          {label.toUpperCase()}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginTop: 2 }}>{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        style={{
          padding: "6px 12px",
          borderRadius: 999,
          border: 0,
          background: "rgba(255,255,255,0.06)",
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Editar
      </button>
    </div>
  );
}

function avgCommission(list: PromoterRow[]) {
  if (!list.length) return 0;
  return Math.round(list.reduce((a, p) => a + p.commissionPct, 0) / list.length);
}

// ============================================================
// Bottom sheets (modales)
// ============================================================
function SheetShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 390,
          background: C.bg2,
          borderRadius: "22px 22px 0 0",
          padding: "22px 22px 32px",
          boxShadow: "0 -1px 0 rgba(255,255,255,0.07) inset",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 999,
              background: "rgba(255,255,255,0.14)",
            }}
          />
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: "-0.025em",
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.4 }}>
            {subtitle}
          </div>
        )}
        <div style={{ marginTop: 18 }}>{children}</div>
        <div style={{ marginTop: 18 }}>{footer}</div>
      </div>
    </div>
  );
}

function AddOrganizerSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (o: OrganizerRow) => void;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const can = name.trim().length > 0 && whatsapp.trim().length > 0;
  return (
    <SheetShell
      title={"¿Quién más\nmaneja contigo?"}
      subtitle="Va a ver los mismos números que tú."
      onClose={onClose}
      footer={
        <Btn
          disabled={!can}
          onClick={() => onSave({ id: uid(), name: name.trim(), whatsapp: whatsapp.trim() })}
        >
          Mandar invitación
        </Btn>
      }
    >
      <Field
        label="WhatsApp"
        mono
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        placeholder="+51 987 234 412"
        active={whatsapp.length > 0}
      />
      <Field
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Mateo Larco"
        active={name.length > 0}
      />
      <div
        style={{
          marginTop: 18,
          padding: "14px 16px",
          borderRadius: 16,
          background: C.purpleSoft,
          boxShadow: `0 0 0 1px ${C.purpleEdge} inset`,
        }}
      >
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            color: C.purple,
            fontWeight: 700,
            marginBottom: 10,
          }}
        >
          ◆ PODRÁ
        </div>
        <PermRow text="Ver ventas y validaciones en vivo" />
        <PermRow text="Editar entradas y promotores" />
        <PermRow text="Cerrar y pagar al final" last />
      </div>
    </SheetShell>
  );
}

function PermRow({ text, last }: { text: string; last?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.06)",
        fontSize: 13,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path
          d="M2 7.5L5.5 11 12 3"
          stroke={C.purple}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span>{text}</span>
    </div>
  );
}

function AddPromoterSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (p: PromoterRow) => void;
}) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [pct, setPct] = useState<number>(15);
  const [otherOpen, setOtherOpen] = useState(false);
  const [other, setOther] = useState("");

  const finalPct = otherOpen ? Number(other || 0) : pct;
  const can = name.trim().length > 0 && whatsapp.trim().length > 0 && finalPct > 0;

  return (
    <SheetShell
      title={"Suma a alguien\na tu equipo."}
      subtitle="Recibe su link único por WhatsApp ni bien guardes."
      onClose={onClose}
      footer={
        <Btn
          disabled={!can}
          onClick={() =>
            onSave({
              id: uid(),
              name: name.trim(),
              whatsapp: whatsapp.trim(),
              commissionPct: finalPct,
            })
          }
        >
          Guardar y mandar link
        </Btn>
      }
    >
      <Field
        label="WhatsApp"
        mono
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        placeholder="+51 998 102 123"
        active={whatsapp.length > 0}
      />
      <Field
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Lucho Mendieta"
        active={name.length > 0}
      />
      <div style={{ marginTop: 4 }}>
        <div
          style={{
            fontSize: 12,
            color: C.dim,
            marginBottom: 8,
            letterSpacing: "0.04em",
          }}
        >
          COMISIÓN POR ENTRADA
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[10, 15, 20].map((v) => (
            <CommissionChip
              key={v}
              label={`${v}%`}
              selected={!otherOpen && pct === v}
              onClick={() => {
                setPct(v);
                setOtherOpen(false);
              }}
            />
          ))}
          <CommissionChip
            label="otro"
            small
            selected={otherOpen}
            onClick={() => setOtherOpen(true)}
          />
        </div>
        {otherOpen && (
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            inputMode="numeric"
            placeholder="%"
            style={{
              ...inlineInputStyle,
              marginTop: 10,
              fontFamily: FONT_MONO,
            }}
          />
        )}
      </div>
    </SheetShell>
  );
}

function CommissionChip({
  label,
  selected,
  small,
  onClick,
}: {
  label: string;
  selected?: boolean;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: small ? "0 0 64px" : 1,
        padding: "12px 0",
        borderRadius: 14,
        border: 0,
        textAlign: "center",
        background: selected ? C.purpleSoft : "rgba(255,255,255,0.04)",
        boxShadow: selected
          ? `0 0 0 1.5px ${C.purple} inset`
          : `0 0 0 1px ${C.line} inset`,
        fontFamily: FONT_DISPLAY,
        fontWeight: 700,
        fontSize: small ? 13 : 16,
        letterSpacing: "-0.01em",
        color: selected ? "#fff" : small ? C.dim : "#fff",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
