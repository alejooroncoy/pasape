import { Icon } from "../icons";

export function CheckBadge() {
  return (
    <span
      aria-hidden="true"
      className="inline-grid size-[22px] place-items-center rounded-full bg-cart-accent-soft text-cart-accent"
    >
      <Icon name="check" width={12} height={12} />
    </span>
  );
}
