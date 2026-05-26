export const Loading = ({ label = "Cargando…" }: { label?: string }) => (
  <div role="status" className="flex flex-col items-center gap-3 py-12 text-(--color-fg-muted)">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-accent)" />
    <span className="text-sm">{label}</span>
  </div>
);
