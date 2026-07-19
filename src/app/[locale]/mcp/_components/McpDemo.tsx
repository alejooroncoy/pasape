"use client";

import { useEffect, useState } from "react";

const STEPS = [
  {
    prompt: "Crea un borrador para una fiesta este sábado en Barranco, con preventa a S/20 y general a S/30.",
    tool: "pasape.create_event",
    title: "Borrador creado",
    detail: "Noche en Barranco · Sáb 15 ago · 10:00 p. m.",
  },
  {
    prompt: "Agrega 120 entradas de preventa y 200 generales. Déjalo sin publicar.",
    tool: "pasape.update_tickets",
    title: "Entradas configuradas",
    detail: "Preventa S/20 · General S/30 · Evento sin publicar",
  },
  {
    prompt: "Muéstrame cómo van las ventas y cuántas personas ya ingresaron.",
    tool: "pasape.event_stats",
    title: "Estado del evento",
    detail: "48 vendidas · 31 ingresaron · S/1,260 recaudado",
  },
];

export function McpDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => (current + 1) % STEPS.length), 4600);
    return () => window.clearInterval(timer);
  }, []);

  const current = STEPS[step];
  return (
    <div className="mcp-demo overflow-hidden rounded-[28px] border border-white/10 bg-[#111015] p-3 shadow-[0_28px_80px_rgba(20,13,38,.26)] sm:p-5">
      <div className="rounded-[19px] bg-[#f8f7f3] p-4 text-[#24222a] sm:p-7">
        <div className="flex items-center justify-between border-b border-[#e5e1d7] pb-4 text-sm font-semibold">
          <div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-lg bg-[#6d3ee9] text-xs text-white">P</span>Pasape Assistant</div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#e5e1d7] bg-white px-3 py-1.5 text-xs"><i className="size-2 rounded-full bg-[#96d91c]" />Conectado a Pasape</span>
        </div>
        <div className="mx-auto mt-6 max-w-[620px]">
          <div className="rounded-2xl bg-[#eeece4] px-5 py-4 text-[15px] leading-6 text-[#4d4a54] sm:text-lg" aria-live="polite">{current.prompt}</div>
          <div className="mcp-tool mt-5 inline-flex items-center gap-2 rounded-xl bg-[#25232c] px-4 py-3 font-mono text-xs text-white sm:text-sm"><span className="font-sans text-base font-semibold text-[#cab9ff]">Pasape</span><span className="text-white/35">|</span>{current.tool}<span className="ml-1 grid size-5 place-items-center rounded-full bg-[#96d91c] text-[11px] text-[#263600]">✓</span></div>
          <div className="mcp-result mt-4 rounded-2xl border-l-4 border-[#8cca19] bg-white p-5 shadow-[0_10px_32px_rgba(42,35,55,.11)]" key={current.title}>
            <div className="flex items-start gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#e9f8cb] font-semibold text-[#5a8109]">✓</span><div><p className="text-lg font-semibold tracking-[-.02em]">{current.title}</p><p className="mt-1 text-sm leading-6 text-[#6b6670]">{current.detail}</p></div></div>
          </div>
          <div className="mt-8 flex items-center gap-2 rounded-2xl border border-[#e5e1d7] bg-white px-4 py-3 text-sm text-[#77727d]"><span className="grid size-5 place-items-center rounded-md border border-[#ded9cd]">+</span>Pregúntale algo sobre tu organización<span className="ml-auto grid size-8 place-items-center rounded-lg bg-[#e17b5d] text-lg text-white">↑</span></div>
        </div>
      </div>
      <style jsx>{`@keyframes result-in { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } } .mcp-result { animation: result-in .42s ease-out both; } @media (prefers-reduced-motion: reduce) { .mcp-result { animation: none; } }`}</style>
    </div>
  );
}
