#!/usr/bin/env tsx
// Registra los templates de docs/whatsapp-templates.json en Meta vía Kapso.
// Uso: WABA_ID=xxxxx pnpm tsx scripts/register-whatsapp-templates.ts
//
// Requiere KAPSO_API_KEY en .env. WABA_ID lo obtenés del dashboard Kapso
// o de Meta Business Manager (es el business_account_id, no el phone_number_id).
//
// Meta tarda 1-24h en aprobar UTILITY. Hasta que esté "APPROVED", el envío
// fallará silenciosamente y caerá al fallback de email.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WABA_ID = process.env.WABA_ID;
const KAPSO_API_KEY = process.env.KAPSO_API_KEY;

if (!WABA_ID) {
  console.error("Falta WABA_ID. Uso: WABA_ID=xxxxx pnpm tsx scripts/register-whatsapp-templates.ts");
  process.exit(1);
}
if (!KAPSO_API_KEY) {
  console.error("Falta KAPSO_API_KEY en .env");
  process.exit(1);
}

const specPath = resolve(process.cwd(), "docs/whatsapp-templates.json");
const spec = JSON.parse(readFileSync(specPath, "utf8")) as {
  templates: Array<Record<string, unknown>>;
};

const url = `https://api.kapso.ai/meta/whatsapp/v24.0/${WABA_ID}/message_templates`;

for (const tpl of spec.templates) {
  const name = tpl.name as string;
  process.stdout.write(`→ ${name}... `);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": KAPSO_API_KEY,
      },
      body: JSON.stringify(tpl),
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      console.log(`❌ ${res.status} ${JSON.stringify(json)}`);
    } else {
      console.log(`✅ ${(json.status as string) ?? "submitted"} (id: ${json.id ?? "?"})`);
    }
  } catch (e) {
    console.log(`❌ ${(e as Error).message}`);
  }
}
