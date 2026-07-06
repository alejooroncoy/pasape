"use client";

import { useEffect } from "react";
import { clientEvents } from "@/lib/analytics/clientEvents";
import { useCurrentUser } from "@/lib/identity/hooks/useCurrentUser";

export function PostHogIdentify() {
  const { data } = useCurrentUser();
  const user = data?.user;

  useEffect(() => {
    if (!user) return;
    clientEvents.identify(user.id, {
      email: user.email,
      name: user.fullName,
    });
  }, [user?.id]);

  return null;
}
