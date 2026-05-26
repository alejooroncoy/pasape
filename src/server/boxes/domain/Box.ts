export type BoxMember = {
  profileId: string;
  name: string;
  ticketId: string | null;
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
