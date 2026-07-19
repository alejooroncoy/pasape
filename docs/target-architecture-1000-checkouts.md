# Arquitectura objetivo: 1,000 checkouts concurrentes

> Estado: diseño objetivo. No autoriza aún un cambio de infraestructura.

## Decisión

Pasape continúa como **monolito modular**. No se fragmenta por moda en
microservicios. La diferencia es que los módulos con perfiles de carga
incompatibles se despliegan por separado:

- Vercel sirve web, catálogo, SEO, panel y APIs no críticas.
- Un `checkout-service` stateless atiende reserva, creación de orden y pago.
- Un `worker-service` procesa efectos no críticos: email, WhatsApp, analytics,
  conciliación y reintentos.

El código de dominio sigue siendo compartido y versionado en un mismo repositorio.

## Topología

```text
                         ┌─────────────────────────────────────┐
                         │ CDN + WAF + rate limit por edge      │
                         │ catálogo cacheado / waiting room     │
                         └──────────────┬──────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    │                                       │
             Vercel / serverless                    Load balancer gestionado
          web, SEO, panel, browse                           │
                                                         ┌───┴────┐
                                                         │        │
                                              checkout A │        │ checkout B
                                              stateless  │        │ stateless
                                                         └───┬────┘
                                                             │
                         ┌───────────────────────────────────┼──────────────────┐
                         │                                   │                  │
                    PostgreSQL/Supabase                 Redis/KV          Mercado Pago
                 fuente de verdad de stock            admisión, TTL       pago/webhook
                         │                                   │                  │
                         └─────────────────────── outbox ────┴──→ worker A/B ──┘
                                                         email / WhatsApp
```

`checkout A` y `checkout B` son instancias activas a la vez, no una primaria y
una de respaldo fría. El load balancer hace health checks y quita una instancia
si falla. Se despliegan en zonas distintas, idealmente en la misma región que
Postgres para no añadir latencia a cada reserva.

Un VPS puede ser una primera implementación, pero debe correr un artefacto
inmutable (contenedor), no un servidor modificado a mano. Para un contrato
importante se prefiere un runtime gestionado de contenedores/VMs con autoescalado
antes que administrar failover manual de VPS.

## El mecanismo que evita caídas: admisión por evento

Mil personas haciendo click a la vez no significa que mil transacciones deban
golpear la misma fila de inventario a la vez. Para preventas de alta demanda:

1. El visitante entra a una sala de espera por `eventId`.
2. Redis entrega un permiso corto y firmado para entrar al checkout.
3. Solo un número configurable de compradores por evento avanza cada segundo.
4. El checkout crea una reserva de inventario con TTL y una order idempotente.
5. Si no paga, la reserva expira y el cupo vuelve a estar disponible.

La cola no es una limitación comercial: es control de presión. Permite mantener
una experiencia predecible y auditable durante un pico, en lugar de devolver
errores o permitir que la base de datos se congestione.

Redis acelera la admisión y el TTL, pero **Postgres sigue siendo la fuente de
verdad**. La reserva se confirma en una RPC transaccional que valida cupo y
devuelve el reservation/order id. Nunca se depende solo de un contador Redis
para decidir quién obtuvo una entrada.

## Flujo crítico

```text
permitido por waiting room
  → POST /reservations (idempotency key)
  → RPC reserve_inventory(event, ticket type, qty, expires_at)
  → order pending
  → pago a Mercado Pago con idempotency key
  → webhook firmado
  → settlement transaccional
  → outbox durable
  → worker entrega QR y notificaciones
```

El webhook debe guardar primero un `payment_event` idempotente y responder
rápido. El settlement y la entrega pueden reintentarse desde la cola. Así una
caída de WhatsApp, Resend o analytics nunca bloquea un pago aprobado.

## Estado actual y brechas

La base actual ya tiene controles útiles: validación de stock en la base,
idempotencia del pago, expiración de órdenes pendientes y una RPC que crea la
orden pendiente junto con sus tickets en una sola transacción. Las
notificaciones se difieren para no frenar la respuesta, pero todavía no
constituyen una cola durable con reintentos auditables. Tampoco existe la
reserva explícita ni la admisión por evento.

Por eso, el objetivo no se declara conseguido por usar Vercel o Supabase. Se
consigue cuando las reservas, el outbox y las pruebas de fallo demuestren las
garantías de la tabla siguiente.

## Capacidad objetivo

La meta se expresa en dos números distintos:

| Métrica | Objetivo inicial |
|---|---:|
| Personas conectadas al checkout | 1,000 concurrentes |
| Compradores admitidos al flujo crítico | 50–100 concurrentes por evento |
| Reserva p95 (sin proveedor de pago) | < 500 ms |
| Creación de orden p95 | < 1 s |
| Confirmación de pago | Asíncrona; depende de Mercado Pago |
| Sobreventa | 0 |
| Recuperación de instancia checkout | sin perder órdenes ni reservas |

El número 50–100 es una perilla que se calibra con pruebas. Una venta con
capacidad limitada puede tener 1,000 personas esperando y solo 80 mutando el
inventario; eso es mucho más sólido que aceptar 1,000 escrituras simultáneas
sobre el último ticket.

## Dinero y responsabilidad

La infraestructura no debería ser el principal coste variable. El coste grande
es procesamiento de pagos, soporte, fraude, chargebacks y liquidación al
organizador.

- Si Mercado Pago procesa y liquida directamente según el acuerdo comercial,
  Pasape no necesita financiar cada compra.
- Si Pasape recibe fondos, conserva saldo o adelanta pagos, aparece riesgo de
  tesorería, conciliación y regulación; eso requiere límites por organizador,
  reservas de riesgo y contratos, no solo servidores más grandes.

## Requisitos antes de venderlo a un partner grande

- Staging aislado con datos y credenciales sandbox.
- Contrato de capacidad/soporte con Supabase, Vercel y Mercado Pago para la
  ventana de venta.
- Pruebas de 100, 300 y 1,000 usuarios; además de último cupo, webhook
  duplicado, caída de una instancia, caída de Redis y retraso de Mercado Pago.
- Dashboard y alertas para p50/p95/p99, errores, lock waits, reservas vencidas,
  pagos pending, tasa de aprobación y profundidad de cola.
- Runbook de incidente y botón operativo para bajar la tasa de admisión.
- Backups, restauración ensayada y retención/auditoría de órdenes y pagos.

## Ruta incremental

1. Agregar tabla de reservas + RPC atómica + expiración.
2. Implementar outbox y worker durable dentro del monorepo.
3. Medir `Server-Timing` y contención de Postgres.
4. Mover solo el módulo checkout/worker a dos instancias detrás de un load
   balancer; el resto permanece en Vercel.
5. Introducir waiting room por evento y hacer ensayos de capacidad.

Este diseño permite crecer sin reescribir Pasape ni convertirlo prematuramente
en una red de microservicios.
