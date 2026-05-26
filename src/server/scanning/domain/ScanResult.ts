export type ScanResultKind = "valid" | "already_used" | "invalid" | "void" | "unknown_event";

export type ScanResult = {
  kind: ScanResultKind;
  ticketId?: string;
  eventId?: string;
  scannedAt: string;
  // Why: el portero necesita ver el último-2 del DNI y el nombre del holder
  // para evitar que pase otra persona con un screenshot. Si el ticket fue
  // comprado sin DNI (guest sin completar), holderDniLast2 viene null.
  holderName?: string | null;
  holderDniLast2?: string | null;
  ticketTypeName?: string | null;
  /** Si el ticket pertenece a un box, etiqueta humana del box ("A", "VIP-1"). */
  boxLabel?: string | null;
  /** Nombre del host del box — útil para el portero: "invitado por X". */
  boxHostName?: string | null;
  /** Asistentes con QR válido (incluyendo host) en este box. */
  boxFilled?: number | null;
  /** Capacidad total del box. */
  boxCapacity?: number | null;
};
