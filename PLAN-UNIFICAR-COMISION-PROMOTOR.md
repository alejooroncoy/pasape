# Plan: unificar los dos mecanismos de comisión del promotor

> Rama de trabajo: `refactor/unificar-comision-promotor` (base `origin/main` limpia).
> WIP de la sesión anterior preservado en: `wip/panel-promotor-sesion` (commit `07ab7aa`).

## 1. El problema (raíz)

Hoy conviven **dos mecanismos independientes** para configurar cómo se le paga a un
promotor, y **nada obliga a elegir uno**. Por eso un mismo evento puede mostrar
"20% **Y** hitos" a la vez (contradicción real).

**Mecanismo 1 — Esquema de comisión (el que se QUEDA como modelo)**
- Discriminador `commission_type`: `percentage | tiered | inkind`.
- Config en jsonb `commission_config` (`{tiers}` / `{rewards}`).
- **Herencia 3 niveles**: link → evento → marca.
- Columnas: `events.promoter_commission_{pct,type,config}`,
  `org_promoters.{default_commission_pct,commission_type,commission_config}`,
  `promoter_links.{commission_pct,commission_type,commission_config_override}`.
- Se resuelve en `src/server/promoters/application/CommissionResolver.ts`
  (`resolveCommissionScheme`, `computePromoterPayout`).
- UI de tipo: `EventSchemeCard` en
  `src/app/[locale]/org/events/[slug]/team/page.tsx` (~líneas 526, 571-583, 1029-1089).

**Mecanismo 2 — Hitos negociados (el que se BAJA a nivel backend; su UI se REUSA)**
- Tabla aparte `commission_tiers` (`{promoter_link_id, threshold_count,
  reward_kind: cash/bottle/custom, reward_amount_cents, reward_label, unlocked_at}`).
- **Solo por-link** (sin herencia).
- BC completo: `src/server/promoters/tiers/` (domain `CommissionTier`, ports,
  application `CommissionTierServices`, infra `SupabaseCommissionTierRepository`).
- API: `src/app/api/promoters/links/[id]/tiers/route.ts` (+ `[tierId]/route.ts`).
- **UI (esta se REUSA)**: `src/app/[locale]/org/events/[slug]/promoters/[linkId]/tiers/page.tsx`
  (`CashSection` = hitos en efectivo estilo Square, `PerkSection` = premios en
  especie, `ComposerSheet` = editor).
- Hook: `src/lib/promoters/tiers/hooks/useCommissionTiers.ts`.
- Se dispara en: `src/server/payments/application/HandleWebhook.ts`
  (`recalcUnlocksForLink`) y `src/server/tickets/infrastructure/repositories/SupabaseTicketRepository.ts`.

**Por qué el backend "parecía" andar**: `getEarnings` en
`SupabasePromoterRepository.ts` inventa una regla de precedencia ad-hoc ("si hay
tiers desbloqueados usa esos, si no usa el %") — convención dispersa en el código,
no una garantía del modelo.

## 2. La decisión

- **Modelo = Mecanismo 1** (jsonb `commission_config` con herencia). El
  `commission_type` es el discriminador rector: dice **cómo** se paga.
- **UI = la del Mecanismo 2** (`/tiers`, que ya está buena), pero **reapuntada** a
  escribir en `commission_config` en lugar de la tabla.
- **Se baja todo el backend del Mecanismo 2** (tabla + repo + API + `recalcUnlocks`).
- **Invariante nuevo**: solo puede haber hitos si `commission_type` ∈ {`tiered`,`inkind`}.
  Un `percentage` no puede tener hitos → "20% + hitos" pasa a ser imposible de construir.

**Beneficio colateral**: el jsonb se evalúa **al vuelo** con `computePromoterPayout`
(no persiste `unlocked_at`) → naturalmente reversible (reembolso baja el payout solo),
sin premios fantasma, sin doble fuente. Varios bugs parcheados en la sesión anterior
desaparecen por diseño.

### Decisión de niveles (resolver antes de codear)
La tabla del Mec. 2 es por-link; el esquema del Mec. 1 tiene herencia. Al unificar en
el jsonb del esquema:
- **Opción A (recomendada)**: hitos como parte del esquema con herencia (evento
  define el template para todos; el override por-link personaliza el caso raro).
  Encaja con "configura una vez + personaliza el caso raro".
- Opción B: dar niveles/scope a una tabla. Más complejo. Descartar salvo que la
  auditoría diga lo contrario.

### Forma nueva del `commission_config` (enriquecer)
El jsonb debe absorber la expresividad de la UI del Mec. 2 (efectivo + especie con
label). Propuesta de shape unificado:
```ts
// commission_type: "tiered" | "inkind"  →  config.milestones
type Milestone = {
  salesCount: number;        // umbral en ENTRADAS vendidas (no órdenes)
  rewardKind: "cash" | "bottle" | "custom";
  amountCents: number | null; // solo cash
  label: string;
};
// "percentage" → config = null (el % vive en commission_pct)
```
`computePromoterPayout` se ajusta para leer `config.milestones` (cash suma
`amountCents`; especie devuelve la lista de premios conseguidos).

## 3. Pasos de ejecución

### FASE 0 — Auditoría de datos (read-only, ANTES de tocar nada)
Correr contra Supabase (dev). Objetivo: saber a cuántos afecta y si algún pago cambia.
- ¿Cuántos `promoter_links` tienen filas en `commission_tiers`?
- ¿Cuántos usan `commission_config` jsonb (evento/marca/link) tiered/inkind?
- ¿Cuántos tienen la **combinación mixta** (`commission_type` ≠ tiered/inkind pero con
  filas en `commission_tiers`)?
- Para cada link con datos: ¿el payout calculado con la tabla difiere del que daría el
  jsonb? (para no cambiar pagos sin querer).
- Salida: una tabla de "links afectados + delta de pago". Si delta ≠ 0 en alguno,
  decidir caso por caso antes de migrar.

### FASE 1 — Enriquecer el modelo (Mec. 1)
1. `src/server/promoters/domain/OrgPromoter.ts`: nuevo shape `CommissionConfig` con
   `milestones` (unificar `tiers`/`rewards` → `milestones` con `rewardKind`).
2. `src/server/promoters/application/CommissionResolver.ts`:
   - `coerceCommissionConfig` acepta el shape nuevo (y migra el viejo si aparece).
   - `computePromoterPayout` lee `config.milestones`; el conteo (`ticketsSold`) es
     **entradas** (usar `promoter_sold_units`, ver FASE 5).
3. Tests unit del resolver con el shape nuevo (percentage / tiered-cash / inkind).

### FASE 2 — Reapuntar la UI (reusar la del Mec. 2)
1. `src/app/[locale]/org/events/[slug]/promoters/[linkId]/tiers/page.tsx`: que
   `CashSection`/`PerkSection`/`ComposerSheet` guarden en `commission_config`
   (vía el endpoint del esquema, `PATCH .../promoters/scheme` o el override por-link),
   NO en `/api/promoters/links/[id]/tiers`.
2. `EventSchemeCard` (`team/page.tsx`): al elegir "Hitos"/"Especie", embeber o enlazar
   ese mismo editor (una sola UI de hitos).
3. Reemplazar `useCommissionTiers` por lectura del `commission_config` resuelto.
4. **Guard de invariante en la UI**: si el tipo es `percentage`, no se pueden agregar
   hitos (el editor de hitos solo aparece con tiered/inkind).

### FASE 3 — Bajar el backend del Mec. 2
Borrar (tras confirmar FASE 0/2):
- `src/server/promoters/tiers/` (domain, ports, application, infra completos).
- `src/app/api/promoters/links/[id]/tiers/` (route + `[tierId]`).
- `src/lib/promoters/tiers/hooks/useCommissionTiers.ts`.
- Llamadas a `recalcUnlocksForLink` en `HandleWebhook.ts` y `SupabaseTicketRepository.ts`.
- Lectura de `commission_tiers` en `SupabasePromoterRepository.ts` (`getEarnings`):
  reemplazar por `computePromoterPayout(scheme)`.

### FASE 4 — Migración de datos + invariante
1. Migración SQL: mover filas de `commission_tiers` → `commission_config.milestones`
   del nivel correspondiente (por-link → `commission_config_override`).
2. **DROP TABLE `commission_tiers`** (con guard de existencia, idempotente; revoke
   explícito no aplica al dropear).
3. Invariante a nivel dato: al escribir esquema, si `type = percentage` ⇒
   `config = null`. Validar en el repositorio de escritura del esquema.
4. Seguir el patrón del repo para migraciones (idempotencia, `set search_path=''`,
   ver `supabase/migrations/20260703010100_settle_order_paid.sql`).

### FASE 5 — Rescatar del WIP lo que sigue sirviendo
Del commit `07ab7aa` (`wip/panel-promotor-sesion`), traer con cherry-pick/diff SOLO:
- Migración `promoter_sold_units` (conteo canónico de ENTRADAS) — clave para que los
  hitos cuenten entradas, no órdenes. `supabase/migrations/20260704180000_promoter_sold_units.sql`.
- KPIs reales en `getHomeData` (grossCents / validatedCount / payoutCents).
- Panel del promotor: `metas/page.tsx`, `_shell/MilestoneCard.tsx`, tab "Metas" en
  `_shell/PromoterShell.tsx`, agrupación mensual + modalidad única en `earnings/page.tsx`.
- **Descartar** del WIP: todo lo de `commission_tiers` (reversibilidad, recalc) — se va
  con la tabla; y la edición de `incentives/page.tsx` (ese archivo ya fue borrado en main).
- Adaptar cada pieza al modelo unificado (leer `commission_config`, no la tabla).

### FASE 6 — Validación E2E
- Escenario con Supabase dev (enlazar el usuario dev/real a un promotor).
- Verificar en el navegador (gstack `/browse` o claude-in-chrome):
  - Evento `percentage`: fila muestra "% por entrada", sin hitos.
  - Evento `tiered`/`inkind`: fila "Ganas por hitos" + Metas con progreso por entradas.
  - Reembolso baja el payout solo (reversibilidad natural del jsonb).
  - Imposible configurar "percentage + hitos" (invariante).
- `npx tsc --noEmit` limpio. Correr tests del resolver.

## 4. Riesgos / cuidados
- **Cambia pagos reales**: no migrar sin la FASE 0. Si algún link cambia de payout,
  decidir caso por caso.
- La UI del Mec. 2 asume por-link; con herencia hay que decidir a qué nivel escribe
  (default evento vs override link) — resolver con la Opción A.
- Mantener `promoter_sold_units` como unidad de conteo (entradas), no órdenes.
- `origin/main` está activo en esta área (acaban de eliminar incentivos): rebasear seguido.
