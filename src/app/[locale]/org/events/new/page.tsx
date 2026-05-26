"use client";

import { OrgShell } from "@/app/[locale]/org/_shell/OrgShell";
import { EventComposer } from "../_components/EventComposer";

export default function NewEventComposerPage() {
  return (
    <OrgShell>
      <EventComposer mode="create" />
    </OrgShell>
  );
}
