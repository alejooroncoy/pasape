"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/_shared/api-client";
import type { FollowedOrg } from "@/server/identity/application/ListFollows";
import { useCurrentUser } from "./useCurrentUser";

export const followingKey = ["identity", "follows"] as const;

export const useFollowing = () => {
  const me = useCurrentUser();
  const loggedIn = !!me.data?.user;

  return useQuery({
    queryKey: followingKey,
    queryFn: () => api.get<FollowedOrg[]>("/api/identity/follows"),
    enabled: loggedIn,
  });
};
