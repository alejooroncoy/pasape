"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { FollowedOrg } from "@/server/identity/application/ListFollows";

export const followingKey = ["identity", "follows"] as const;

export const useFollowing = () =>
  useQuery({
    queryKey: followingKey,
    queryFn: () => api.get<FollowedOrg[]>("/api/identity/follows"),
  });
