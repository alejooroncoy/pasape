"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";

export type SendInviteResult = {
  delivered: boolean;
  expiresAt: string;
  whatsapp: string;
};

export const useSendPromoterInvite = (orgPromoterId: string) =>
  useMutation({
    mutationFn: () =>
      api.post<SendInviteResult>(`/api/org/promoters/${orgPromoterId}/send-invite`),
  });
