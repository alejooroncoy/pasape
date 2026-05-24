"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useCreateOrg } from "@/lib/identity/organizations/hooks/useCreateOrg";
import { useMyOrgs } from "@/lib/identity/organizations/hooks/useMyOrgs";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Field } from "@/components/ui/Field";
import { useRouter } from "@/i18n/navigation";

const MAX_ORGS = 5;

export default function NewOrgPage() {
  const t = useTranslations("organizations.create");
  const [name, setName] = useState("");
  const create = useCreateOrg();
  const orgs = useMyOrgs();
  const router = useRouter();

  // Why: pre-block the form client-side when we already know the cap is hit,
  // so the user doesn't waste a request. The server still enforces the limit.
  const atLimit =
    (orgs.data?.length ?? 0) >= MAX_ORGS ||
    (create.error instanceof Error && create.error.message === "org_limit_reached");

  const errorMessage = (() => {
    if (!create.error) return null;
    const msg = (create.error as Error).message;
    if (msg === "org_limit_reached") return t("limitReached");
    return msg;
  })();

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="mb-6 text-2xl font-semibold">{t("title")}</h1>
      <div className="flex flex-col gap-4">
        <Field label={t("name")}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={atLimit}
          />
        </Field>
        <Button
          block
          size="lg"
          disabled={create.isPending || !name || atLimit}
          onClick={async () => {
            await create.mutateAsync({ name });
            router.replace("/org");
          }}
        >
          {create.isPending ? t("submitting") : t("submit")}
        </Button>
        {atLimit && !errorMessage && (
          <div className="rounded-2xl border border-(--color-border) bg-(--color-bg-card) p-4 text-sm">
            <p className="font-medium text-(--color-fg)">{t("limitReached")}</p>
            <p className="mt-1 text-(--color-fg-subtle)">{t("limitReachedHelp")}</p>
          </div>
        )}
        {errorMessage && (
          <p className="text-sm text-(--color-danger)">{errorMessage}</p>
        )}
      </div>
    </main>
  );
}
