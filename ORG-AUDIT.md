# Auditoría del Panel del Organizador — Pasape

> 52 hallazgos confirmados (verificados contra el código, no falsos positivos). Ordenados por severidad ajustada. Cada ítem incluye `ruta:línea` y un fix accionable.
> Contexto ICP: Paula (productora multi-marca, demo al directorio) y Piero (opera promotores, paga por reporte). Regla de arquitectura: **el frontend solo muestra; el backend decide** (el `status` es la única fuente de verdad, prohibido inferir estado de negocio con `new Date()`).

---

## 1. Resumen ejecutivo

El panel **funciona pero miente con los números de dinero y de ventas** — justo el activo más sensible para el ICP. Hay tres bugs de **doble división por 100** que muestran el recaudado 100x más chico, KPIs de ventas/validadas **hardcodeados a 0** en las pantallas más visibles, y el **dolor #1 del ICP (reportes/Excel) tiene data corrupta silenciosa**: el Excel se trunca a 1000 filas sin aviso, incluye órdenes no pagadas, y los desgloses por tipo se recalculan en el cliente ignorando preventa/promos, por lo que **no cuadran con el total**. Sumado a violaciones de la regla "frontend solo muestra" (revenue y staleness calculados en cliente) y a un **reembolso que deja los KPIs inflados** (no actualiza `orders.status` ni dispara broadcast).

La buena noticia: la mayoría de los bugs de alto impacto son de **display o de contrato de datos** (no corrupción persistente) y los fixes son aditivos y de bajo riesgo. Prioridad: estabilizar los números antes de cualquier demo.

### Top 5 a arreglar YA

1. **Doble `/100` en reportes globales** — `org/reports/page.tsx:132` (+ tabla `1137,1190,1110,1160`, desglose `921-923`). S/12,500 se muestra como S/125. Pantalla con la que Piero cierra pagos.
2. **Doble `/100` en la home del organizador** — `org/OrgHomeClient.tsx:69`. KPI "Recaudado" 100x chico en la primera pantalla del ICP.
3. **Ventas (`sold`) hardcodeadas a 0** — `org/events/_components/EventCard.tsx:27` (`const sold = 0;`). Toda card comunica "0 ventas". Y mini-KPIs "Validadas"/"Recaudado" del card "Evento en vivo" fijos a 0 — `OrgHomeClient.tsx:117-119`.
4. **Excel trunca a 1000 filas sin error** — `SupabaseEventRepository.ts:811-822` (+ `605`, `656`). Reporte al directorio queda incompleto y silencioso.
5. **Reembolso/contracargo no actualiza `orders.status` ni dispara broadcast** — `payments/application/HandleWebhook.ts:62-67`. KPIs en vivo inflados tras un refund; ticket reembolsado sigue válido en puerta.

---

## 2. Reportes & Excel (dolor #1 del ICP) 🔴

> Toda la corrección de datos del reporte vive aquí. Es la pantalla con la que Paula reporta al directorio y Piero paga a promotores; un número que no cuadra mata la confianza.

### 2.1 Dinero mostrado 100x más chico (doble división por 100)

- **[ALTA]** `org/reports/page.tsx:132` — `formatMoney(cents)` ya hace `cents/100` internamente, pero se le pasan valores **ya en soles**: KPI Recaudado (`kpis.revenue = revenueCents/100`, línea 70), tabla de promotores (`formatMoney(r.revenueCents/100)` en 1137/1190, `avg` en 1110/1160), desglose (`formatMoney(r.price)` con `price = priceCents/100` en 921-923). **Fix:** pasar SIEMPRE céntimos a `formatMoney`; eliminar los `/100` previos y trabajar `groupTicketRows` en céntimos.
- **[ALTA]** `org/OrgHomeClient.tsx:69` — `formatMoney(liveRevenue / 100)` con `liveRevenue = revenueCents`. **Fix:** `formatMoney(liveRevenue)`.

### 2.2 Revenue por tipo recalculado en cliente (no cuadra con el total)

- **[ALTA]** `org/events/[slug]/report/page.tsx:153` — `formatMoney(t.priceCents * t.sold)` recomputa ingresos en frontend, ignorando preventa/2x1/3x2/cortesías/reembolsos. La suma del desglose **no iguala** `revenueCents` (que sí viene del rollup real). Viola "frontend solo muestra". **Fix:** agregar `revenueCents` por `ticketType` en `EventStats` (calculado server-side desde líneas de orden pagadas, igual que ya hace `byPromoter.revenueCents`); renderizar `formatMoney(t.revenueCents)`.
- **[MEDIA]** `org/events/[slug]/page.tsx:373-374,389,402-403` — mismo patrón `priceCents * sold` en el panel de evento (entradas y boxes). **Fix:** consumir `revenueCents` agregado por tipo/box del backend.
- **[MEDIA]** `events/application/ExportEventReport.ts:103` — el Excel calcula recaudado por tipo como `(t.priceCents * t.sold)/100`; el split no cuadra con `summary.revenueCents` (rollup real). **Fix:** tomar recaudado real por tipo desde la DB; agregar al rollup/view.

### 2.3 Excel: data loss y contaminación

- **[ALTA→media]** `SupabaseEventRepository.ts:811-822` (+ `paidTickets` 605, `pTickets` 656) — queries de tickets sin `.range()`/paginación; PostgREST corta a 1000 filas **sin error**. Evento >1000 entradas exporta incompleto. Latente hoy (tabla ~120 filas) pero crítico para eventos grandes de Paula. **Fix:** paginar con `.range(from,to)` en bucle (ordering estable) o RPC que devuelva todo.
- **[ALTA→media]** `SupabaseEventRepository.ts:811-851` — la hoja Asistentes **no filtra** por `order.status='paid'` ni ticket status: incluye órdenes pending/expired (mostradas como "Activa"), void y refunded. No cuadra con la hoja Resumen (que sí filtra paid + active/used, líneas 605-610). **Fix:** `.eq('order.status','paid')` + `.in('status',['active','used'])`, o segmentar/marcar anuladas claramente.
- **[ALTA→media]** `SupabaseEventRepository.ts:662-668` — `ticketsByOrder` hace `sold += 1` para TODA fila sin filtrar status (solo `validated` filtra `used`). Infla `ticketsSold` por promotor, que **alimenta `computePromoterPayout`** (línea 751) → sobrepago de comisiones por entradas void/refund parcial. Mismo bug en `PromoterDetail.ts:93-99`. **Fix:** contar solo `active`/`used` (alinear con `soldByType`).
- **[MEDIA]** `ExportEventReport.ts:43,87` — `usedAt`/`startsAt` escritos como string ISO en UTC crudo. Lima es UTC-5: un scan de 22:00 sábado aparece 03:00 domingo, y Excel no lo trata como fecha. **Fix:** convertir a `America/Lima` y escribir como `Date` con `numFmt`, reusando el formatter central.
- **[MEDIA]** `ExportEventReport.ts:38-48,64-72` — **inyección de fórmulas (CSV/Excel injection)**: `holderName`, `buyerEmail`, `promoterCode`, `name` de promotor (input de usuario) se escriben directo. Un valor que empiece con `= + - @ TAB CR` se ejecuta como fórmula al abrir. **Fix:** prefijar con comilla simple `'` esos casos en todas las columnas con datos de usuario.

### 2.4 Reportes globales: datos ocultos / inconsistentes

- **[MEDIA]** `org/reports/page.tsx:1159` — el backend ya calcula `payoutCents`/`commissionType`/`unlockedRewards` por promotor (`EventRepository.ts:76-85`) pero la tabla no los muestra. Es el "cuánto le debo a cada uno" de Piero, oculto. **Fix:** columna "A pagar" = `formatMoney(r.payoutCents)` (céntimos) + chips de `unlockedRewards`. No derivar en cliente.
- **[MEDIA]** `migrations/20260527140000_event_sales_series_view.sql:16` — la serie de ventas bucketiza en UTC (`date_trunc('day', created_at)`) y `buildSeries()` (page.tsx:649-656) también; ventas nocturnas caen en el día equivocado, el punto "Hoy" se corre. El evento ya tiene `timezone='America/Lima'`. **Fix:** `date_trunc('day', created_at AT TIME ZONE 'America/Lima')` en la view + alinear el cliente, o devolver serie densa del backend.
- **[BAJA]** `org/reports/page.tsx:75** — `conversion = sold/capacity*100`: `capacity` null → 0%, sin cap, y mezcla unidades de ticket vs asientos de box. **Fix:** `occupancyPct` calculado en backend; mostrar "—" si null.
- **[BAJA]** `org/reports/page.tsx:181** — header dice "X promotores" usando `byPromoter.length` (incluye 0 ventas) pero la tabla filtra `ticketsSold>0`. **Fix:** contar `.filter(r=>r.ticketsSold>0).length` o copy "X con ventas".
- **[BAJA]** `org/events/[slug]/report/page.tsx:89` — `formatMoney` con `PEN` hardcodeado (latente multi-moneda; `ev.currency` ya existe). **Fix:** `formatMoney(revenue, ev?.currency)`. Cubrir también línea 153.

---

## 3. Realtime — cobertura de Broadcast 🟠

> Arquitectura definida: vista `event_stats` + Broadcast desde DB (trigger), **NO `postgres_changes`**; refetch con debounce.

- **[ALTA]** `payments/application/HandleWebhook.ts:62-67` — `mapOrderStatus()` devuelve `null` para `refunded`/`charged_back`: solo escribe `mp_status`, **no toca `orders.status`** (queda `paid`). Doble consecuencia: (1) `event_stats_rollup` sigue contando esa orden en `sold`/`revenue` (filtra `status='paid'`) → KPI inflado; (2) el trigger `orders_broadcast_stats` es `AFTER UPDATE OF status` → un update que solo toca `mp_status` no emite `stats_changed`. **Fix:** mapear a estado terminal (`refunded`), actualizar `orders.status`, anular tickets + devolver stock (como la rama `failed`); el trigger existente ya emite el broadcast.
- **[MEDIA]** `OrgHomeClient.tsx:117-119` — mini-KPIs "Validadas" (`value="0"`) y "Recaudado" (`formatMoney(0)`) del card "Evento en vivo" hardcodeados, pese a estar ya suscrito a `useRealtimeEventStats`. **Fix:** `Validadas = String(liveStats.data?.validated ?? 0)`; `Recaudado = formatMoney((liveStats.data?.revenueCents ?? 0))` (sin doble /100 — usar el mismo criterio corregido del KPI superior).
- **[MEDIA]** `org/team/[id]/page.tsx:92** — KPIs del detalle de promotor sin realtime **ni polling**: `useOrgPromoterDetail` es un `useQuery` plano. Durante la noche del evento los números quedan congelados. **Fix:** suscribir cada `eventId` de `byEvent` al broadcast e invalidar la key del detalle con debounce, o mínimo `refetchInterval`/`refetchOnWindowFocus`.
- **[BAJA]** `lib/scanning/hooks/useScanRealtime.ts:18-25** — usa `postgres_changes` sobre `scan_events` (contra la arquitectura), sin filtro por `event_id` y sin debounce; **redundante** con el trigger `scan_events_broadcast_stats` que ya emite al topic `event-stats:<id>` consumido por `useRealtimeEventStats`. Ambos hooks corren juntos en `events/[slug]/page.tsx:23,25` invalidando la misma queryKey. **Fix:** eliminar `useScanRealtime`; opcional sacar `scan_events` de la publicación realtime (migración 20260607160000).
- **[BAJA]** `org/events/[slug]/page.tsx:23-25** — el debounce de 400ms se pierde porque `useScanRealtime` invalida inmediato la misma queryKey; en ráfaga de scans dispara N refetches. Se resuelve al eliminar `useScanRealtime` (ítem anterior).
- **[BAJA]** `org/events/[slug]/report/page.tsx:15** — pantalla de reporte final no llama `useRealtimeEventStats` (solo polling 15s), inconsistente con las otras 3 pantallas. **Fix:** `useRealtimeEventStats(ev?.id, slug)`. Impacto acotado (artefacto post-evento).
- **[BAJA]** `OrgEventsClient.tsx:29** — lista de eventos sin realtime de KPIs. Hoy es deuda bloqueada (las cards muestran `sold=0` hardcodeado); resolver junto con el ítem de ventas reales en EventCard.
- **[BAJA]** `migrations/20260608120000_broadcast_event_stats.sql** — cambios de aforo (`ticket_types`) no emiten `stats_changed` (trigger solo en orders/scan_events). Cubierto por polling 15s. **Fix opcional:** trigger `AFTER INSERT/UPDATE OF capacity OR DELETE ON ticket_types`.

---

## 4. Arquitectura — "frontend solo muestra" 🟠

> Lógica de negocio (montos cobrados, staleness, estado) que no debería vivir en el cliente.

- **[ALTA]** Revenue por tipo recalculado en cliente — `report/page.tsx:153` y `events/[slug]/page.tsx:373-403` (ver §2.2). Cálculo de monto cobrado en frontend.
- **[MEDIA]** `org/events/[slug]/page.tsx:594-602` — `DoorHealthBanner` decide qué puertas están "sin sincronizar" con `Date.now()` del navegador y un `STALE_MIN=3` hardcodeado. El reloj del dispositivo puede dar falsos positivos. **Fix:** que `getDoorHealth` (backend) devuelva `isStale`/`minutesSinceSync` con `now()` de la DB; mover el umbral al backend.
- **[MEDIA]** `org/events/[slug]/report/page.tsx:44** — "REPORTE FINAL" hardcodeado sin leer `ev.status`. Si el evento sigue `published`, llamarlo "final" contradice las cifras que aún cambian. **Fix:** derivar la etiqueta de `ev.status` (`closed`/`cancelled` → "FINAL"; si no, "EN VIVO"/"AVANCE"). No usar fechas.

---

## 5. UX / ICP (por tab) 🟡

### Inicio (`org/OrgHomeClient.tsx`)
- **[BAJA]** StatCard "Recaudado" muestra recaudo de un solo evento junto a KPIs agregados de marca (línea 69). **Fix:** renombrar a "Recaudado (evento en vivo)" o pedir agregado real al backend.
- **[BAJA]** `StatusPill` (246) no cubre `closed`/`cancelled` → muestra el status crudo en inglés. **Fix:** agregar "Cerrado"/"Cancelado" + fallback en español.

### Lista de eventos (`org/events/_components/`)
- **[ALTA]** `EventCard.tsx:27` — `const sold = 0;` hardcodeado (ver §1). **Fix:** exponer `soldCount`/`grossCents` en `/api/events?scope=mine` desde el rollup; o esconder la barra si no hay dato.
- **[BAJA]** `EventCard.tsx:15** — un evento `cancelled` se rotula "Finalizado" (variant `past`). **Fix:** derivar etiqueta de `event.status` ("Cancelado" vs "Finalizado").
- **[BAJA]** `OrgEventsClient.tsx:47** — búsqueda solo filtra la tab activa; "Sin resultados" aunque exista en otra. **Fix:** contadores por tab sensibles a la búsqueda + salto.

### Panel de evento (`org/events/[slug]/page.tsx`)
- **[BAJA]** "Validadas" (panel vivo, 86) vs "asistieron" (reporte, 277) — dos nombres para el mismo dato. **Fix:** unificar (cuidando que "asistieron" a mitad de evento puede engañar; "Ingresaron" es más preciso en vivo).
- **[BAJA]** Header de promotores promete "vendido · validado · ingreso" pero el revenue es `hidden sm:inline` (107,329,541-543); en mobile (Piero) solo se ven 2 números. **Fix:** mostrar ingreso compacto en mobile o recortar el subtítulo.
- **[BAJA]** `:143** — doble truncado `scansRecent.slice(0,10)` sobre límite del backend (no-op redundante). **Fix:** confiar en el límite del backend o documentarlo como defensivo.

### Reporte de evento (`report/page.tsx`)
- **[BAJA]** `:168** — botones "Compartir"/"Transferir →" sin `onClick` (UI muerta); "Transferir" es ambiguo. **Fix:** cablear handlers reales; renombrar a "Exportar Excel" / "Solicitar liquidación".
- **[BAJA]** `:110** — "no shows" anglicismo. **Fix:** "no asistieron" / "faltaron".

### Equipo (`org/team/`)
- **[BAJA]** `team/page.tsx:36** — badge de Co-organizadores suma activos + invitaciones pendientes (no coincide con la sección "Activos"). **Fix:** mostrar solo activos o formato "2 (+2)".
- **[BAJA]** `team/[id]/page.tsx:221** — barra de progreso normalizada a un máximo fijo arbitrario de 200 entradas. **Fix:** normalizar contra aforo/meta del backend, o quitar la barra.
- **[BAJA]** `team/page.tsx:454** — `confirm()` nativo para quitar promotor rompe la estética (sheets animados); pobre en webview/Capacitor. **Fix:** mini-sheet de confirmación.

### Equipo del evento (`org/events/[slug]/team/page.tsx`)
- **[MEDIA]** `:406** — link de promotor desactivado (`active=false`, cuando tiene órdenes pagadas) se muestra idéntico a uno activo, con "Copiar link"/"Quitar". `AssignmentRow` nunca lee `assignment.active`. **Fix:** chip "DESACTIVADO", atenuar fila, deshabilitar copiar/WhatsApp, ofrecer "Reactivar".
- **[BAJA]** `:471** — cupo de promotor sin progreso de ventas ("32/50"); el dato vive en otra pantalla. **Fix:** mostrar vendido/cupo desde el backend (no sumar en cliente).
- **[BAJA]** `:202,372** — `confirm()` nativo para quitar co-orgs/promotores. **Fix:** mini-diálogo coherente con `Sheet`.
- **[BAJA]** `:604** — `QuotaEditor`: campo vacío o `<1` se convierte silenciosamente en cupo ilimitado (∞) → riesgo de sobreventa. **Fix:** acción separada "Sin límite (∞)" o confirmar al pasar de número a ∞.
- **[BAJA]** `:445** — filas de promotor sin cabeceras de columna (%, cupo, WhatsApp). **Fix:** fila de encabezados sutil o labels/tooltips ("Comisión 15%", "Cupo 50").

### Ajustes (`org/settings/page.tsx`)
- **[MEDIA]** `lib/identity/hooks/useUpdateOrganization.ts:23** — invalida `['identity','my-orgs']` pero `useMyOrgs` usa `['identity','orgs','mine']`: la lista de orgs **nunca** se refresca tras guardar (barra "Guardar" pegada, datos stale). **Fix:** importar `myOrgsKey` y usarlo.
- **[MEDIA]** `settings/page.tsx:43** — el slug se captura para la URL del PATCH; tras renombrar, un segundo guardado pega a `/{slugViejo}` → `org_not_found`. Causa raíz: la key de invalidación de arriba. **Fix:** corregir la invalidación (o construir el endpoint por `id`).
- **[MEDIA]** `settings/page.tsx:36** — sin estados loading/error/empty: durante la carga los inputs se ven vacíos (parece marca borrada). **Fix:** skeleton/error/empty antes de montar el formulario.
- **[MEDIA]** `settings/page.tsx:267** — botón "Eliminar marca" sin handler en una sección "Acción irreversible". **Fix:** ocultar/deshabilitar con tooltip "Próximamente" hasta cablear confirmación de doble paso.
- **[BAJA]** `settings/page.tsx:71** — error de subida de logo silenciado (catch vacío) y sin acción para quitar logo. **Fix:** toast/inline error + botón "Quitar" (`setLogoPreview(null)`).
- **[BAJA]** `settings/page.tsx:107** — subtítulo promete "cuenta y notificaciones" que no existen en esta pantalla. **Fix:** ajustar copy a marca/pagos/eliminar.
- **[BAJA]** `settings/page.tsx:393** — número de cuenta bancaria valida solo `>=4` dígitos (igual en el zod del backend). **Fix:** subir a `>=8` o validar por banco (principalmente en el backend); el CCI sí valida 20 exactos.

---

## 6. Tabla final (por severidad)

| Severidad | Área | Archivo:línea | Fix |
|---|---|---|---|
| ALTA | Reportes | `org/reports/page.tsx:132` (+1137,1190,1110,1160,921-923) | Pasar siempre céntimos a `formatMoney`; quitar `/100` previos |
| ALTA | Reportes | `org/OrgHomeClient.tsx:69` | `formatMoney(liveRevenue)` (sin /100 extra) |
| ALTA | Datos | `org/events/_components/EventCard.tsx:27` | Exponer `soldCount` en `listMine` desde rollup; quitar `const sold = 0` |
| ALTA | Reportes/Arq | `org/events/[slug]/report/page.tsx:153` | `revenueCents` por tipo server-side; renderizar, no multiplicar |
| ALTA | Realtime | `payments/application/HandleWebhook.ts:62-67` | Mapear refunded/charged_back a estado terminal; update `orders.status` |
| MEDIA | Excel | `SupabaseEventRepository.ts:811-822` (+605,656) | Paginar con `.range()` en bucle |
| MEDIA | Excel | `SupabaseEventRepository.ts:811-851` | Filtrar `order.status='paid'` + ticket `active/used` |
| MEDIA | Comisiones | `SupabaseEventRepository.ts:662-668` (+`PromoterDetail.ts:93-99`) | Contar `sold` solo `active/used` |
| MEDIA | Excel | `ExportEventReport.ts:43,87` | Fechas a `America/Lima` como `Date` con `numFmt` |
| MEDIA | Seguridad | `ExportEventReport.ts:38-48,64-72` | Prefijar `'` celdas que empiezan con `= + - @ TAB CR` |
| MEDIA | Excel | `ExportEventReport.ts:103` | Recaudado real por tipo desde DB |
| MEDIA | Reportes | `org/reports/page.tsx:1159` | Columna "A pagar" = `payoutCents` |
| MEDIA | Datos | `migrations/20260527140000_event_sales_series_view.sql:16` | `date_trunc(... AT TIME ZONE 'America/Lima')` |
| MEDIA | Datos | `org/events/[slug]/page.tsx:373-403` | `revenueCents` por tipo/box del backend |
| MEDIA | Realtime | `org/OrgHomeClient.tsx:117-119` | Usar `validated`/`revenueCents` reales |
| MEDIA | Realtime | `org/team/[id]/page.tsx:92` | Realtime o `refetchInterval` |
| MEDIA | Arq | `org/events/[slug]/page.tsx:594-602` | `isStale` server-side, mover `STALE_MIN` |
| MEDIA | UX | `org/events/[slug]/report/page.tsx:44` | Etiqueta derivada de `ev.status` |
| MEDIA | UX | `org/events/[slug]/team/page.tsx:406` | Mostrar/atenuar links `active=false` |
| MEDIA | Cache | `lib/identity/hooks/useUpdateOrganization.ts:23` | Usar `myOrgsKey` correcto |
| MEDIA | Bug | `org/settings/page.tsx:43` | Endpoint por `id` o arreglar invalidación |
| MEDIA | UX | `org/settings/page.tsx:36` | Skeleton/error/empty |
| MEDIA | UX | `org/settings/page.tsx:267` | Deshabilitar "Eliminar marca" |
| BAJA | UX | `org/OrgHomeClient.tsx:69,246` | Renombrar KPI; `StatusPill` closed/cancelled |
| BAJA | UX | `org/events/_components/EventCard.tsx:15` | Etiqueta por `event.status` |
| BAJA | UX | `OrgEventsClient.tsx:47` | Contadores de búsqueda por tab |
| BAJA | Realtime | `lib/scanning/hooks/useScanRealtime.ts:18-25` | Eliminar (redundante con broadcast) |
| BAJA | Realtime | `org/events/[slug]/page.tsx:23-25` | Resuelto al quitar `useScanRealtime` |
| BAJA | Realtime | `org/events/[slug]/report/page.tsx:15` | Añadir `useRealtimeEventStats` |
| BAJA | Realtime | `OrgEventsClient.tsx:29` | Realtime tras conectar ventas reales |
| BAJA | Realtime | `migrations/20260608120000_broadcast_event_stats.sql` | Trigger opcional en `ticket_types` |
| BAJA | UX | `org/events/[slug]/page.tsx:86-87,107,143` | Unificar "Validadas"; ingreso en mobile; quitar slice |
| BAJA | UX | `org/events/[slug]/report/page.tsx:89,110,168` | currency; "no asistieron"; cablear botones |
| BAJA | Datos | `org/reports/page.tsx:75,181` | `occupancyPct` backend; contar promotores con ventas |
| BAJA | UX | `org/team/page.tsx:36,454` | Badge solo activos; mini-sheet confirm |
| BAJA | UX | `org/team/[id]/page.tsx:221` | Normalizar barra contra aforo/meta |
| BAJA | UX | `org/events/[slug]/team/page.tsx:202,372,445,471,604` | confirm→sheet; headers; progreso cupo; ∞ explícito |
| BAJA | UX | `org/settings/page.tsx:71,107,393` | Logo error+quitar; copy; min cuenta |
