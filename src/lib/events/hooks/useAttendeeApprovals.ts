"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { PendingApproval } from "@/server/tickets/ports/TicketRepository";

export const pendingApprovalsKey = (slug: string) =>
  ["events", slug, "attendees", "pending"] as const;

export const usePendingApprovals = (slug: string) =>
  useQuery({
    queryKey: pendingApprovalsKey(slug),
    queryFn: () => api.get<PendingApproval[]>(`/api/events/${slug}/attendees/pending`),
    enabled: !!slug,
  });

export const useDecideRegistration = (slug: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, decision }: { orderId: string; decision: "approved" | "rejected" }) =>
      api.post<{ orderId: string }>(
        `/api/events/${slug}/attendees/${orderId}/${decision === "approved" ? "approve" : "reject"}`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingApprovalsKey(slug) });
      qc.invalidateQueries({ queryKey: ["events", "stats", slug] });
    },
  });
};
