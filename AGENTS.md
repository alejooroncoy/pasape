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

## QR rotativo — ventana de 10 segundos

El QR del ticket cambia **cada 10 segundos** (`WINDOW_SECONDS = 10` en `@/lib/tickets/signedQr`).

- La firma ECDSA P-256 es **no-determinística**: llamar a `signWindow` dos veces con los mismos argumentos produce firmas distintas.  
- Por tanto, **solo se firma una vez por ventana** — cachear el `windowIdx` en un ref y reutilizar el payload mientras el índice no cambie.  
- El timer de 1 s solo debe actualizar `secondsLeft` para el countdown ring, nunca re-firmar.
- El QR usa `errorCorrectionLevel: "H"` para reservar espacio al logo centrado (máx ~30 % del área).
