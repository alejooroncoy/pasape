/** 987654321 → "987 654 321" */
export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 9) return d;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** 987654321 → "987•••321" */
export function maskPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length < 6) return d;
  return `${d.slice(0, 3)}•••${d.slice(-3)}`;
}

export function transferErrorCopy(raw: string): string {
  switch (raw) {
    case "transfer_window_closed":
      return "Ya no se puede enviar — la ventana cerró cerca del evento.";
    case "transfers_disabled":
      return "Este evento no permite transferencias.";
    case "transfer_limit_reached":
      return "Esta entrada alcanzó el máximo de transferencias.";
    case "not_owner":
      return "No eres el dueño actual de esta entrada.";
    case "ticket_not_active":
      return "Esta entrada ya no está activa (usada o anulada).";
    case "invalid_phone":
      return "Revisa el número — deben ser 9 dígitos.";
    case "recipient_required":
      return "Necesitamos a quién enviarla.";
    default:
      return raw;
  }
}
