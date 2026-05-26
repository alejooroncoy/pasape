import { cn } from "@/lib/_shared/cn";

type AvatarProps = {
  src?: string | null;
  alt: string;
  size?: number;
  className?: string;
};

export const Avatar = ({ src, alt, size = 32, className }: AvatarProps) => {
  const initials = alt
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded-full bg-(--color-bg-card) text-(--color-fg-muted) text-xs font-medium",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label={alt}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        initials || "·"
      )}
    </span>
  );
};
