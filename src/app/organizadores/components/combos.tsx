import { QrSquare } from "./qr-square";
import { SectionHeader } from "./ui/section-header";
import { CheckBadge } from "./ui/check-badge";

const COMBO_POINTS = [
  "Una persona compra el 3x2, paga una sola vez.",
  "Pasape genera un QR por cada amigo.",
  "Cada QR entra por separado y se valida solo.",
  "Sin grupos de WhatsApp, sin capturas, sin perder a nadie.",
];

export function Combos() {
  return (
    <section
      id="combos"
      className="border-y border-line bg-bg py-24 md:py-30"
    >
      <div className="mx-auto w-full max-w-[1160px] px-[22px] md:px-8">
        <SectionHeader
          eyebrow="Combos · 2x1 · 3x2"
          title={
            <>
              Una compra. Varios QR. <em>Cero reenvíos.</em>
            </>
          }
        />
        <div className="mt-12 grid grid-cols-1 items-center gap-14 md:grid-cols-2 md:gap-20">
          <div>
            <p className="m-0 max-w-[60ch] text-pretty text-[clamp(16px,1.6vw,19px)] leading-[1.55] text-ink-2">
              En un 3x2, cada amigo recibe su QR directo. Sin capturas, sin
              grupos de WhatsApp, sin perder a nadie en puerta.
            </p>
            <ul className="reveal mt-7 grid list-none gap-0 border-t border-line p-0">
              {COMBO_POINTS.map((p) => (
                <li
                  key={p}
                  className="grid grid-cols-[24px_1fr] gap-3.5 border-b border-line py-4 text-[15px] leading-normal text-ink-2 last:border-b-0"
                >
                  <CheckBadge />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal" aria-hidden="true">
            <div className="combo-stack">
              <div className="mini-ticket t1">
                <div className="qr-mini">
                  <QrSquare seedOffset={1} />
                </div>
                <div>
                  <div className="mt-label">Entrada 1 / 3</div>
                  <div className="mt-name">Para Diego</div>
                  <div className="mt-code">PSP · 7K3M-A001</div>
                </div>
              </div>
              <div className="mini-ticket t2">
                <div className="qr-mini">
                  <QrSquare seedOffset={2} />
                </div>
                <div>
                  <div className="mt-label">Entrada 2 / 3</div>
                  <div className="mt-name">Para Lucía</div>
                  <div className="mt-code">PSP · 7K3M-A002</div>
                </div>
              </div>
              <div className="mini-ticket t3">
                <div className="qr-mini">
                  <QrSquare seedOffset={3} />
                </div>
                <div>
                  <div className="mt-label">Entrada 3 / 3</div>
                  <div className="mt-name">Para Renzo</div>
                  <div className="mt-code">PSP · 7K3M-A003</div>
                </div>
              </div>
              <div className="combo-pill">Promo 3x2 · S/ 60</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
