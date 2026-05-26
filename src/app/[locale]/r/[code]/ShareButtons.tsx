"use client";

import { useState } from "react";

/**
 * Two action buttons promoters use to share their personal sale link:
 *   - Copy → writes to clipboard, flips label for 1.5s
 *   - WhatsApp → opens wa.me with a pre-filled message
 */
export function ShareButtons({
  url,
  eventTitle,
}: {
  url: string;
  eventTitle: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback: select-and-prompt could go here; clipboard API failures are
      // usually permission issues, so we silently no-op.
    }
  };

  const wspHref = `https://wa.me/?text=${encodeURIComponent(
    `Estoy vendiendo ${eventTitle} 🎟️\n${url}`,
  )}`;

  return (
    <div className="mt-6 flex gap-2">
      <button
        type="button"
        onClick={copy}
        className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-white/15"
      >
        {copied ? "Copiado ✓" : "Copiar link"}
      </button>
      <a
        href={wspHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 rounded-2xl bg-[#22D17F] px-4 py-3 text-center text-[14px] font-semibold text-black transition hover:brightness-110"
      >
        Compartir por WhatsApp
      </a>
    </div>
  );
}
