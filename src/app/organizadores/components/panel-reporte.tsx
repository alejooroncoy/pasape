import { SectionHeader } from "./ui/section-header";

export function PanelReporte() {
  return (
    <section id="panel" className="py-24 md:py-30">
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Panel en vivo"
          title={
            <>
              Tu fiesta en tiempo real. <em>No al día siguiente.</em>
            </>
          }
          lede="Ventas, accesos, combos y promotores corriendo en vivo. Al cierre tienes un reporte — no capturas sueltas ni un Excel a las 4 a.m."
        />

        <div className="reveal relative mt-12 overflow-hidden rounded-[22px] border border-line-strong shadow-[0_0_0_1px_rgba(184,124,255,0.1),0_30px_60px_-20px_rgba(0,0,0,0.6)]">
          <img
            src="/marketing/panel-real.png"
            alt="Panel de organizador de Pasape mostrando ventas, ingresos y accesos de un evento en vivo"
            width={1440}
            height={800}
            className="block w-full"
          />
        </div>
        <p className="reveal mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-4">
          Captura real del panel · evento de prueba
        </p>
      </div>
    </section>
  );
}
