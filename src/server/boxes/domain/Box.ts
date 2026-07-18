export type BoxMember = {
  /** null cuando el asiento es de un acompañante SIN cuenta (su QR lo lleva el
      host). La identidad estable del miembro es `ticketId`, no este campo. */
  profileId: string | null;
  name: string;
  ticketId: string | null;
  /** El QR de este miembro lo sostiene el host en su device (acompañante sin
      celular): current_holder == dueño del box. El host lo muestra en puerta. */
  heldByHost: boolean;
  /** El ticket ya fue escaneado en puerta (status "used"). Si entró, ya no se
      puede quitar del box. */
  used: boolean;
  joinedAt: string;
};

export type Box = {
  id: string;
  orderId: string;
  ticketTypeId: string;
  ticketTypeName: string;
  inviteToken: string;
  boxNumber: string | null;
  capacity: number;
  expiresAt: string;
  createdAt: string;
  members: BoxMember[];
  event: {
    id: string;
    slug: string;
    title: string;
    startsAt: string;
    venue: string | null;
    timezone: string;
  };
  ownerName: string;
};
