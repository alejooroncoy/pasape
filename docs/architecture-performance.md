# Arquitectura de rendimiento — Pasape

## Objetivo

Servir descubrimiento de eventos con baja latencia sin debilitar el flujo que
crea entradas. La plataforma distingue explícitamente entre **lecturas públicas
cacheables** y **decisiones de compra transaccionales**.

## Camino de lectura

```text
Navegador
  ├─ Home público → ISR (60 s) → EventsController.listPublic → Data Cache
  ├─ Evento público → CDN (30 s + SWR) → EventsController.getBySlug
  │                                      → Data Cache (30 s)
  └─ Sesión privada → /api/identity/me después de hidratar
```

El home no lee cookies en el render del servidor. Por eso su HTML/RSC puede
compartirse entre visitantes. La identidad llega como una consulta privada del
cliente: un usuario autenticado recibe su avatar cuando hidrata, pero no vuelve
dinámico el catálogo para todos.

El detalle público de un evento se cachea en la capa de aplicación, no en un
componente. Publicar o editar invalida `events:browse` y `events:public`, por
lo que una modificación no espera al TTL para aparecer.

## Camino de compra

```text
Cliente → quote autoritativo → buy → RPC transaccional PostgreSQL → orden / QR
                                                        └→ after() → email / WhatsApp
```

La caché **nunca** autoriza una venta. Precio, cupo, promociones y estado se
recalculan en el backend dentro del flujo de compra; el frontend solo muestra
el quote recibido. Esto permite que la ficha pública tenga hasta 30 segundos
de staleness sin riesgo de sobreventa.

## Garantías y límites actuales

- Lecturas: home con ISR de 60 s; ficha pública con CDN 30 s y SWR 60 s.
- Mutaciones: invalidación por tag al publicar/editar un evento.
- Compras: rate limit por IP, anti-bot y creación atómica de orden + entradas
  en una RPC de Postgres. Un fallo de stock o de capacidad revierte ambos.
- Entrega: `after()` evita que email/WhatsApp aumenten la latencia de la
  respuesta de compra.
- Observabilidad: cabecera `Server-Timing` en `quote` y `buy`, métricas de
  p50/p95 de los ensayos de carga y Sentry para errores de backend.

## Próximos escalones

1. Añadir `Server-Timing` a home, detalle, quote y buy para separar tiempo de
   CDN, Supabase y proveedor de pago.
2. Llevar el read-model público a una vista/rollup de Postgres si los eventos
   y tipos de entrada superan el volumen actual.
3. Usar colas para notificaciones masivas y webhooks; `after()` es adecuado
   para entrega individual, no para campañas.
4. Mantener el checkout como un monolito modular hasta que una métrica real
   justifique extraer un servicio. Separar servicios antes de tener presión de
   escala haría más difícil garantizar stock y consistencia.
