import { Icon } from "./icons";

export function WaFloat({ waHref }: { waHref: string }) {
  return (
    <a
      href={waHref}
      rel="noopener noreferrer"
      target="_blank"
      aria-label="Hablar por WhatsApp con Pasape"
      className="fixed right-[18px] bottom-[18px] z-[60] grid size-14 place-items-center rounded-full bg-accent text-white shadow-[0_0_0_1px_rgba(255,255,255,0.14)_inset,0_14px_30px_-8px_var(--color-accent-glow-strong),0_0_40px_-10px_var(--color-accent)] transition-[transform,box-shadow,filter] duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.04] hover:brightness-110 md:right-6 md:bottom-6"
    >
      <Icon name="whatsapp" width={26} height={26} />
    </a>
  );
}
