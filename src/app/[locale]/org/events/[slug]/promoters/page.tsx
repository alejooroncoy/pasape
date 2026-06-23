"use client";

import { use } from "react";
import { EventShell } from "../_shell/EventShell";
import { PromotersSection } from "../team/page";

type Params = Promise<{ slug: string; locale: string }>;

export default function OrgEventPromotersPage({ params }: { params: Params }) {
  const { slug } = use(params);
  return (
    <EventShell slug={slug} active="promoters">
      <div className="mt-6">
        <PromotersSection slug={slug} />
      </div>
    </EventShell>
  );
}
