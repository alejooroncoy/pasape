import { Link } from "@/i18n/navigation";
import type { BreadcrumbItem } from "@/lib/seo/jsonld";

type Props = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: Props) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-cart-ink-3">
      <ol className="m-0 flex flex-wrap items-center gap-2 p-0 list-none">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.path}-${index}`} className="inline-flex items-center gap-2">
              {index > 0 && (
                <span aria-hidden className="text-cart-ink-4">
                  ›
                </span>
              )}
              {isLast ? (
                <span aria-current="page" className="text-cart-ink">
                  {item.name}
                </span>
              ) : (
                <Link
                  // Rutas SEO dinámicas no están en el tipo del router de next-intl.
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  href={item.path as any}
                  className="transition-colors hover:text-cart-ink"
                >
                  {item.name}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
