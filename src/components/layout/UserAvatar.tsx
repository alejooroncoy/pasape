import { cn } from "@/lib/_shared/cn";

// Avatar del usuario: muestra su foto de perfil (Google/Supabase) cuando existe
// y, si no, un fallback con la inicial. `referrerPolicy=no-referrer` evita que
// lh3.googleusercontent.com rechace la imagen por el referer.
type Props = {
  name?: string | null;
  avatarUrl?: string | null;
  /** Tamaño + forma (ej. "size-10 rounded-full"). */
  className?: string;
  /** Estilo del fallback con inicial (ej. "bg-gradient-to-br from-... text-[14px]"). */
  fallbackClassName?: string;
};

export function UserAvatar({ name, avatarUrl, className, fallbackClassName }: Props) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name ?? "Tu perfil"}
        referrerPolicy="no-referrer"
        className={cn("shrink-0 object-cover", className)}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? "·").toUpperCase();
  return (
    <span
      aria-label={name ?? "Tu perfil"}
      className={cn(
        "grid shrink-0 place-items-center font-semibold text-white",
        className,
        fallbackClassName,
      )}
    >
      {initial}
    </span>
  );
}
