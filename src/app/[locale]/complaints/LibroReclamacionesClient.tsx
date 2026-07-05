"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/_shared/cn";
import {
  PLAZO_RESPUESTA_DIAS_HABILES,
  PROVEEDOR,
  TIPO_BIEN_LABEL,
  TIPO_DOCUMENTO_LABEL,
  TIPO_RECLAMACION_DESCRIPCION,
  TIPO_RECLAMACION_LABEL,
  type ComplaintSubmission,
  type TipoBien,
  type TipoDocumento,
  type TipoReclamacion,
} from "@/lib/legal/complaintBook";

type Constancia = { codigo: string; fecha: string; tipo: TipoReclamacion; email: string };

const inputCls =
  "h-12 w-full rounded-2xl border border-cart-line bg-cart-bg-elev px-4 text-base text-white placeholder:text-cart-ink-4 outline-none transition-colors focus:border-(--color-accent)";
const areaCls =
  "min-h-28 w-full rounded-2xl border border-cart-line bg-cart-bg-elev p-4 text-base text-white placeholder:text-cart-ink-4 outline-none transition-colors focus:border-(--color-accent) resize-y";

export function LibroReclamacionesClient() {
  const [tipo, setTipo] = useState<TipoReclamacion>("reclamo");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("dni");
  const [tipoBien, setTipoBien] = useState<TipoBien>("servicio");
  const [esMenor, setEsMenor] = useState(false);
  const [acepta, setAcepta] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [constancia, setConstancia] = useState<Constancia | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!acepta) {
      setError("Debes confirmar la declaración jurada para enviar tu solicitud.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const montoRaw = (fd.get("monto") as string)?.trim();
    const payload: ComplaintSubmission = {
      tipo,
      nombre: (fd.get("nombre") as string)?.trim() ?? "",
      tipoDocumento,
      numeroDocumento: (fd.get("numeroDocumento") as string)?.trim() ?? "",
      domicilio: (fd.get("domicilio") as string)?.trim() ?? "",
      telefono: (fd.get("telefono") as string)?.trim() || undefined,
      email: (fd.get("email") as string)?.trim() ?? "",
      esMenorDeEdad: esMenor,
      apoderado: esMenor ? (fd.get("apoderado") as string)?.trim() || undefined : undefined,
      tipoBien,
      montoSoles: montoRaw ? Number(montoRaw) : undefined,
      descripcionBien: (fd.get("descripcionBien") as string)?.trim() ?? "",
      detalle: (fd.get("detalle") as string)?.trim() ?? "",
      pedido: (fd.get("pedido") as string)?.trim() ?? "",
      aceptaDeclaracion: true,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/legal/complaint-book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Recibimos varias solicitudes desde tu conexión. Espera unos minutos e intenta de nuevo."
            : "No pudimos registrar tu solicitud. Revisa los datos e intenta nuevamente.",
        );
        return;
      }
      const json = (await res.json()) as { data: { codigo: string; fecha: string } };
      setConstancia({ codigo: json.data.codigo, fecha: json.data.fecha, tipo, email: payload.email });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Ocurrió un problema de conexión. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (constancia) {
    return <ConstanciaView constancia={constancia} />;
  }

  return (
    <main className="min-h-screen bg-cart-bg px-[clamp(20px,5vw,40px)] py-[clamp(28px,6vw,64px)] text-white">
      <div className="mx-auto w-full max-w-[720px]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-cart-ink-3 transition-colors hover:text-white"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver al inicio
        </Link>

        <header className="mt-6 flex items-center gap-4">
          <div className="shrink-0 overflow-hidden rounded-2xl bg-white p-2">
            <Image
              src="/libro-de-reclamaciones.png"
              alt="Libro de Reclamaciones"
              width={96}
              height={64}
              className="h-14 w-auto"
              priority
            />
          </div>
          <div>
            <h1 className="text-[clamp(24px,5vw,32px)] font-semibold leading-tight tracking-[-0.02em]">
              Libro de Reclamaciones
            </h1>
            <p className="mt-1 text-sm text-cart-ink-3">
              Conforme a la Ley N° 29571, Código de Protección y Defensa del Consumidor.
            </p>
          </div>
        </header>

        {/* Datos del proveedor */}
        <section className="mt-7 rounded-3xl border border-cart-line bg-cart-bg-elev p-5">
          <h2 className="text-[11.5px] font-medium uppercase tracking-[0.1em] text-cart-ink-3">
            Datos del proveedor
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-[440px]:grid-cols-1">
            <Meta label="Razón social" value={PROVEEDOR.razonSocial} />
            <Meta label="RUC" value={PROVEEDOR.ruc} />
            <Meta label="Nombre comercial" value={PROVEEDOR.nombreComercial} />
            <Meta label="Domicilio" value={PROVEEDOR.direccion} />
          </dl>
        </section>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-8" noValidate>
          {/* Tipo de solicitud */}
          <Section
            title="¿Qué deseas registrar?"
            hint="Elige según tu caso. Ambos se atienden en un plazo máximo de 15 días hábiles."
          >
            <div className="grid grid-cols-2 gap-3 max-[440px]:grid-cols-1">
              {(["reclamo", "queja"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  aria-pressed={tipo === t}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    tipo === t
                      ? "border-(--color-accent) bg-(--color-accent-soft)"
                      : "border-cart-line bg-cart-bg-elev hover:border-cart-line-strong",
                  )}
                >
                  <span className="flex items-center gap-2 text-base font-semibold">
                    <RadioDot active={tipo === t} />
                    {TIPO_RECLAMACION_LABEL[t]}
                  </span>
                  <span className="mt-1.5 block text-[13px] leading-snug text-cart-ink-3">
                    {TIPO_RECLAMACION_DESCRIPCION[t]}
                  </span>
                </button>
              ))}
            </div>
          </Section>

          {/* Datos del consumidor */}
          <Section title="Tus datos" hint="Con estos datos te contactaremos para responder.">
            <FieldRow>
              <FieldBlock label="Nombres y apellidos" required className="col-span-2">
                <input name="nombre" required maxLength={160} autoComplete="name" className={inputCls} placeholder="Ej. María Fernández Rojas" />
              </FieldBlock>
            </FieldRow>
            <FieldRow>
              <FieldBlock label="Tipo de documento" required>
                <select
                  value={tipoDocumento}
                  onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
                  className={cn(inputCls, "appearance-none")}
                >
                  {(Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumento[]).map((k) => (
                    <option key={k} value={k} className="bg-cart-bg-elev">
                      {TIPO_DOCUMENTO_LABEL[k]}
                    </option>
                  ))}
                </select>
              </FieldBlock>
              <FieldBlock label="Número de documento" required>
                <input name="numeroDocumento" required maxLength={32} inputMode="numeric" className={inputCls} placeholder="Ej. 71234567" />
              </FieldBlock>
            </FieldRow>
            <FieldRow>
              <FieldBlock label="Domicilio" required className="col-span-2">
                <input name="domicilio" required maxLength={240} autoComplete="street-address" className={inputCls} placeholder="Av. / Jr. / Calle, distrito, ciudad" />
              </FieldBlock>
            </FieldRow>
            <FieldRow>
              <FieldBlock label="Correo electrónico" required>
                <input name="email" type="email" required maxLength={160} autoComplete="email" className={inputCls} placeholder="tucorreo@email.com" />
              </FieldBlock>
              <FieldBlock label="Teléfono" hint="Opcional">
                <input name="telefono" maxLength={32} inputMode="tel" autoComplete="tel" className={inputCls} placeholder="+51 999 999 999" />
              </FieldBlock>
            </FieldRow>

            <label className="mt-1 flex cursor-pointer items-center gap-3 text-sm text-cart-ink-2">
              <Checkbox checked={esMenor} onChange={setEsMenor} />
              El consumidor es menor de edad
            </label>
            {esMenor && (
              <FieldRow>
                <FieldBlock label="Padre, madre o apoderado" required className="col-span-2">
                  <input name="apoderado" required maxLength={160} className={inputCls} placeholder="Nombre completo del apoderado" />
                </FieldBlock>
              </FieldRow>
            )}
          </Section>

          {/* Bien contratado */}
          <Section title="Identificación del bien contratado">
            <FieldRow>
              <FieldBlock label="Tipo" required>
                <div className="flex gap-2">
                  {(["servicio", "producto"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTipoBien(t)}
                      aria-pressed={tipoBien === t}
                      className={cn(
                        "h-12 flex-1 rounded-2xl border text-sm font-medium transition-colors",
                        tipoBien === t
                          ? "border-(--color-accent) bg-(--color-accent-soft) text-white"
                          : "border-cart-line bg-cart-bg-elev text-cart-ink-2 hover:border-cart-line-strong",
                      )}
                    >
                      {TIPO_BIEN_LABEL[t]}
                    </button>
                  ))}
                </div>
              </FieldBlock>
              <FieldBlock label="Monto reclamado" hint="Opcional (S/)">
                <input name="monto" inputMode="decimal" className={inputCls} placeholder="0.00" />
              </FieldBlock>
            </FieldRow>
            <FieldRow>
              <FieldBlock label="Descripción" required className="col-span-2">
                <input name="descripcionBien" required maxLength={500} className={inputCls} placeholder="Ej. Entrada para el evento X del 12/07" />
              </FieldBlock>
            </FieldRow>
          </Section>

          {/* Detalle */}
          <Section title={`Detalle del ${TIPO_RECLAMACION_LABEL[tipo].toLowerCase()}`}>
            <FieldBlock label="Cuéntanos qué pasó" required>
              <textarea name="detalle" required maxLength={3000} className={areaCls} placeholder="Describe con el mayor detalle posible lo ocurrido." />
            </FieldBlock>
            <FieldBlock label="¿Qué esperas de nosotros?" required>
              <textarea name="pedido" required maxLength={2000} className={areaCls} placeholder="Ej. Reembolso, corrección, reprogramación…" />
            </FieldBlock>
          </Section>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-cart-line bg-cart-bg-elev p-4 text-[13px] leading-snug text-cart-ink-2">
            <Checkbox checked={acepta} onChange={setAcepta} />
            <span>
              Declaro que los datos consignados son verdaderos y que la información brindada corresponde a la
              realidad de los hechos. Acepto ser contactado por {PROVEEDOR.nombreComercial} al correo indicado.
            </span>
          </label>

          {error && (
            <p className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="sticky bottom-4 z-10">
            <button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-full bg-(--color-accent) text-base font-semibold text-white shadow-lg shadow-(--color-accent)/25 transition active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>

          <p className="text-center text-xs leading-relaxed text-cart-ink-4">
            Al enviar, tu {TIPO_RECLAMACION_LABEL[tipo].toLowerCase()} queda registrado con un código de constancia.
            Te responderemos en un plazo máximo de {PLAZO_RESPUESTA_DIAS_HABILES} días hábiles.
          </p>
        </form>
      </div>
    </main>
  );
}

function ConstanciaView({ constancia }: { constancia: Constancia }) {
  const { codigo, fecha, tipo, email } = constancia;
  return (
    <main className="grid min-h-screen place-items-center bg-cart-bg px-6 py-16 text-white">
      <div className="w-full max-w-[480px] text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500/15">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M20 6L9 17l-5-5" stroke="#34d399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-[-0.02em]">
          Recibimos tu {TIPO_RECLAMACION_LABEL[tipo].toLowerCase()}
        </h1>
        <p className="mt-2 text-sm text-cart-ink-3">
          Guarda tu código de constancia. También te enviamos una copia a{" "}
          <span className="text-cart-ink-2">{email}</span>.
        </p>

        <div className="mt-6 rounded-3xl border border-cart-line bg-cart-bg-elev p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-cart-ink-4">
            Código de constancia
          </div>
          <div className="mt-1.5 text-3xl font-semibold tracking-[0.02em] text-white">{codigo}</div>
          <div className="mt-3 border-t border-cart-line pt-3 text-[13px] text-cart-ink-3">{fecha}</div>
        </div>

        {/* Timeline de estado: deja claro qué sigue */}
        <div className="mt-4 rounded-3xl border border-cart-line bg-cart-bg-elev p-6 text-left">
          <TimelineStep
            state="done"
            title="Recibido"
            detail="Registramos tu solicitud y te enviamos la constancia por correo."
          />
          <TimelineStep
            state="current"
            title="En revisión"
            detail={`${PROVEEDOR.nombreComercial} está evaluando tu ${TIPO_RECLAMACION_LABEL[tipo].toLowerCase()}.`}
          />
          <TimelineStep
            state="pending"
            title="Respuesta"
            detail={`Te responderemos en un máximo de ${PLAZO_RESPUESTA_DIAS_HABILES} días hábiles.`}
            last
          />
        </div>

        <Link
          href="/"
          className="mt-7 inline-flex h-12 items-center justify-center rounded-full border border-cart-line px-6 text-sm font-medium text-white transition-colors hover:bg-white/5"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

/* — helpers de presentación — */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-[-0.01em]">{title}</h2>
      {hint && <p className="mt-1 text-[13px] text-cart-ink-3">{hint}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 max-[440px]:grid-cols-1">{children}</div>;
}

function FieldBlock({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      <span className="flex items-center gap-1 text-[13px] font-medium text-cart-ink-2">
        {label}
        {required && <span className="text-(--color-accent)">*</span>}
        {hint && <span className="ml-auto text-[12px] font-normal text-cart-ink-4">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[12px] text-cart-ink-4">{label}</dt>
      <dd className="text-cart-ink-2">{value}</dd>
    </div>
  );
}

function TimelineStep({
  state,
  title,
  detail,
  last,
}: {
  state: "done" | "current" | "pending";
  title: string;
  detail: string;
  last?: boolean;
}) {
  const done = state === "done";
  const current = state === "current";
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border-2",
            done
              ? "border-emerald-500 bg-emerald-500"
              : current
                ? "border-(--color-accent)"
                : "border-cart-line-strong",
          )}
        >
          {done ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : current ? (
            <span className="size-2 rounded-full bg-(--color-accent)" />
          ) : null}
        </span>
        {!last && <span className="my-1 w-0.5 flex-1 rounded-full bg-cart-line" />}
      </div>
      <div className={cn("pb-5", last && "pb-0")}>
        <div className={cn("text-sm font-semibold", done || current ? "text-white" : "text-cart-ink-3")}>
          {title}
        </div>
        <div className="mt-0.5 text-[13px] leading-snug text-cart-ink-3">{detail}</div>
      </div>
    </div>
  );
}

function RadioDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "grid size-4 place-items-center rounded-full border-2 transition-colors",
        active ? "border-(--color-accent)" : "border-cart-line-strong",
      )}
    >
      {active && <span className="size-2 rounded-full bg-(--color-accent)" />}
    </span>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
        checked ? "border-(--color-accent) bg-(--color-accent)" : "border-cart-line-strong bg-transparent",
      )}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20 6L9 17l-5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
