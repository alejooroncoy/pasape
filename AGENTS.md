<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reglas de arquitectura Pasape

## Frontend solo muestra — el backend decide

**El frontend no implementa lógica de negocio.** Solo renderiza datos que recibe del backend.

✅ Permitido en frontend:
- Validar inputs de formularios antes de enviar
- Formatear fechas/números para mostrar al usuario
- Ordenar listas para renderizar (presentación)
- Calcular previews de UI (ej: "termina a las 3am" en el composer)
- Manejar estado local de UI (abrir/cerrar modales, selecciones)

❌ Prohibido en frontend:
- Decidir si un evento está "terminado", "activo" o "pasado" usando `new Date()`
- Filtrar eventos por fecha (`endsAt < now`, `startsAt < now`)
- Calcular si algo está disponible, agotado, o expirado
- Cualquier `.filter()` sobre datos que implique una regla de negocio

**El `status` del evento es la única fuente de verdad.** Si un evento terminó, su `status` es `"closed"`. El frontend solo lee ese campo — nunca lo infiere de fechas.

**El backend (repositorio + pg_cron) mantiene los estados:**
- `pg_cron` cierra automáticamente eventos cuyo `endsAt` ya pasó
- El repositorio filtra por `status` antes de devolver datos al frontend
- El frontend recibe datos ya procesados y los muestra tal cual

**Regla práctica:** si escribes `new Date()` o `Date.now()` fuera de un formatter de display o del EventComposer, detente y pregúntate si esa lógica pertenece al backend.

### Dinero: modelo híbrido (local instantáneo + quote autoritativo)

Validar inputs (formato, requeridos, longitud) en formularios sí es frontend. Pero **el monto que se muestra/cobra lo decide el backend**. El patrón acordado es híbrido:

1. **Feedback instantáneo**: el cliente PUEDE precalcular con el módulo compartido (`@/lib/tickets/serviceFee`, `@/lib/events/pricing`) mientras el usuario arma el carrito (+/− sin lag). Nunca reimplementar la fórmula: solo importar el módulo único.
2. **El server pisa**: en cada transición de paso del checkout se pide `POST /api/tickets/quote` (misma implementación `priceOrder` que usa `buy()` en `SupabaseTicketRepository`) y sus números reemplazan los locales. La orden creada (`res.order.totalCents/serviceFeeCents`) es la verdad final en la fase de pago.
3. **Drift = bug**: si el precálculo local difiere del quote/orden, se loggea `[checkout] drift` — significa que el módulo compartido quedó desincronizado del server (versiones desplegadas distintas, etc.).

Motivo: la fórmula ya cambió varias veces (por tramos → piso único → S/3) y una vista que "olvidó" aplicar el fee mostró S/1 donde se cobraba S/4. Ver `useOrderQuote` (`@/lib/tickets/hooks/useTickets`) y su uso en `events/[slug]/buy/page.tsx`.

## Box vs entrada individual — `capacity` es ambiguo

Un **box** y una **entrada individual** comparten la tabla `ticket_types`, pero NO son lo mismo:

| | Entrada individual | Box / espacio |
|---|---|---|
| Qué es | 1 acceso = 1 persona | 1 espacio para N personas |
| `kind` | `"general"` / `"vip"` … | `"box"` |
| `capacity` significa | **stock** (cuántas se venden) | **asientos** (cuántas personas entran) |
| Stock vendible | `capacity` | **1** (se vende entero, el host invita) |
| QR | 1 | 1 del host + invitaciones |

**El dominio `TicketType` es una UNIÓN DISCRIMINADA por `kind`** — el compilador impide confundir asientos con stock:
- `BoxTicketType` → `kind: "box"` + **`seats`** (personas que entran; NO es stock: el box se vende entero, 1 unidad).
- `AdmissionTicketType` → `kind: "general"|"vip"|"invitation"` + **`stock`** (cuántas se venden).

No existe `tt.capacity` en el dominio: TS te obliga a estrechar por `kind` antes de leer `seats` o `stock`. La columna cruda `capacity` de la DB solo se traduce en **un sitio**: el mapper `toTicketType` (`SupabaseEventRepository`). No repliques esa traducción en otro lado.

**Helpers en `@/lib/events/ticketDisplay`** (evitan repetir el `switch (kind)`):
- `isBox(tt)` — type guard que estrecha a `BoxTicketType`
- `boxSeats(tt)` — asientos de un box (0 si no es box)
- `stockTotal(tt)` / `unitsSold(tt)` / `unitsRemaining(tt)` — unidades vendibles (box = 1)
- `ticketStatus(tt)` — disponible/agotado/expirado (box es binario)
- `soldLine(row)` — copy "X de Y vendidas" / "Reservado". **Estructural** (`{kind,sold,capacity}`): es para el read-model de stats del organizador, que todavía expone `capacity` cruda — ese shape NO es el dominio `TicketType`.

Si necesitas una distinción box/entrada nueva en el dominio, agrégala como helper o como campo de la variante correcta — no con `if (tt.kind === "box")` suelto por las pantallas.

`box.capacity` sobre el dominio `Box` (BC boxes) NO es ambiguo: un `Box` siempre son asientos. La ambigüedad histórica era solo de `TicketType`, ya resuelta por la unión.

## QR rotativo — ventana de 10 segundos

El QR del ticket cambia **cada 10 segundos** (`WINDOW_SECONDS = 10` en `@/lib/tickets/signedQr`).

- La firma ECDSA P-256 es **no-determinística**: llamar a `signWindow` dos veces con los mismos argumentos produce firmas distintas.  
- Por tanto, **solo se firma una vez por ventana** — cachear el `windowIdx` en un ref y reutilizar el payload mientras el índice no cambie.  
- El timer de 1 s solo debe actualizar `secondsLeft` para el countdown ring, nunca re-firmar.
- El QR usa `errorCorrectionLevel: "H"` para reservar espacio al logo centrado (máx ~30 % del área).
