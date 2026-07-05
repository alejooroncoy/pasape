"use client";

import { use, useState } from "react";
import { useEvent } from "@/lib/events/hooks/useEvents";
import { useDoorLink } from "@/lib/events/hooks/useDoorLink";
import { EventShell } from "../_shell/EventShell";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgDoorLinkPage({ params }: { params: Params }) {
  const { slug } = use(params);
  useEvent(slug); // precarga para el header del shell
  const door = useDoorLink(slug);
  const [copied, setCopied] = useState(false);

  const url = door.data?.url ?? "";
  const code = door.data?.code ?? "";
  const waHref = url
    ? `https://wa.me/?text=${encodeURIComponent(`Link para escanear en la puerta: ${url}`)}`
    : undefined;

  return (
    <EventShell slug={slug} active="settings" hideTabs>
      <div className="mx-auto mt-6 max-w-[560px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cart-ink-4">
          Acceso portero
        </p>
        <h1 className="mt-2 text-[26px] font-bold leading-tight tracking-[-0.03em]">
          Link para tu portero
        </h1>
        <p className="mt-2 max-w-[46ch] text-[13.5px] leading-relaxed text-cart-ink-3">
          Compártelo con quien va a escanear. Lo abre y ya tiene acceso — te avisamos por email
          cuando alguien lo use. El acceso dura 24&nbsp;h en su dispositivo.
        </p>

        <div className="mt-5 rounded-2xl border border-cart-accent/35 bg-cart-bg-elev p-4 lg:p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cart-ink-4">
            Link del portero
          </div>
          <div className="mt-2 break-all font-mono text-[14px] font-semibold leading-relaxed">
            {url ? (
              <>
                {url.replace(code, "")}
                <span className="text-cart-accent">{code}</span>
              </>
            ) : (
              <span className="text-cart-ink-3">Generando…</span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={!url}
              onClick={() => {
                navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="flex-1 rounded-full border border-cart-line px-4 py-2.5 text-[13px] font-semibold text-cart-ink-2 transition hover:border-cart-line-strong disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className={
                url
                  ? "flex flex-1 items-center justify-center gap-2 rounded-full bg-[rgba(37,211,102,0.14)] px-4 py-2.5 text-[13px] font-semibold text-[#25D366] transition hover:bg-[rgba(37,211,102,0.22)]"
                  : "pointer-events-none flex flex-1 items-center justify-center gap-2 rounded-full bg-cart-bg-elev px-4 py-2.5 text-[13px] font-semibold text-cart-ink-4 opacity-50"
              }
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </EventShell>
  );
}
