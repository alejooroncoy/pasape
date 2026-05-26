"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { User } from "@/server/identity/domain/User";
import { currentUserKey } from "./useCurrentUser";

export type UpdateProfilePayload = {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  dni?: string | null;
  organizerType?: "production_company" | "venue_owner" | "independent_host" | null;
};

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => api.patch<User>("/api/identity/me", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: currentUserKey });
    },
  });
};
