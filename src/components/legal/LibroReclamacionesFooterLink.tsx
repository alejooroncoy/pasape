import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/_shared/cn";

type Props = {
  className?: string;
  /** En footers claros (ej. landing organizadores). */
  variant?: "dark" | "light";
};

/** Enlace + imagen del Libro de Reclamaciones (requisito legal INDECOPI / Ley 29571). */
export function LibroReclamacionesFooterLink({ className, variant = "dark" }: Props) {
  const textCls =
    variant === "light"
      ? "text-ink-3 group-hover:text-ink"
      : "text-cart-ink-3 group-hover:text-cart-ink";

  return (
    <Link href="/complaints" className={cn("group inline-block", className)}>
      <span className={cn("block text-[13.5px] transition-colors", textCls)}>
        Libro de reclamaciones
      </span>
      <Image
        src="/libro-de-reclamaciones.png"
        alt="Libro de Reclamaciones — formulario virtual"
        width={220}
        height={72}
        className="mt-3 h-auto w-[min(100%,220px)] rounded-sm bg-white"
      />
    </Link>
  );
}
