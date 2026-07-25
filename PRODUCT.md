# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Cliente que paga — el organizador esporádico de nightlife.** No es "cualquier organizador de Lima": organiza fiestas, raves o eventos universitarios de forma recurrente pero no constante (unas pocas fechas al año), y hoy vende **a mano** — Excel, WhatsApp, Yape/Plin, "reserva con tu nombre". En la puerta alguien busca nombres en una lista de cientos, sin QR ni trazabilidad. No usa Passline, Joinnus, Ticketera.pe ni Netpass: no porque no las conozca, sino porque no le sale a cuenta aprender una plataforma nueva y pagar comisión por una fecha suelta. La barrera confirmada es **de uso, no solo de precio**.

**Usuario final — el fan.** Compra desde el celular, muchas veces desde un link de Instagram o WhatsApp, y sin cuenta. Necesita su entrada disponible el día del evento aunque la señal sea mala.

**Promotor.** Vende entradas por su cuenta a cambio de comisión y/o hitos. Se da de alta postulando a un link de grupo y lo aprueba el organizador.

**Portero.** Escanea en la puerta, de noche, con red saturada o inexistente. Trabaja desde una app aparte (SPA Vite empaquetada con Capacitor), no desde este proyecto web.

**Quién manda cuando chocan:** cada superficie tiene su dueño. En lo público — `/`, `/events`, checkout, `/tickets`, `/favorites`, `/profile` — manda el fan. En `/org` y `/promo` manda el organizador. No se resuelve un conflicto global: se respeta el dueño de la superficie.

## Product Purpose

Que un organizador que hoy vende a mano pueda cobrar, entregar entradas con QR y controlar la puerta sin aprender una plataforma de ticketing, y que el fan reciba su entrada sin fricción y sin obligación de crear cuenta.

Éxito a corto plazo: correr pilotos reales con organizadores esporádicos y que Pasape cubra su propia infraestructura (meta septiembre 2026, sin capital externo).

## Positioning

El hueco no es "falta una ticketera más" — las que existen funcionan bien para quien las necesita. El hueco es que **ninguna baja a atender al organizador esporádico**, porque el modelo de comisión-por-volumen no calza con baja frecuencia y el onboarding asume que el organizador ya sabe qué es una plataforma de ticketing.

Contra los incumbentes de nightlife (Netpass) no se gana siendo "otro QR", sino con lo que ellos no dan: **atribución de promotor, box, lista de invitados y defensa anti-reventa**.

Nightlife independiente es un **wedge, no el techo**. La apuesta es que servirlo bien construye el activo que escala: una base real de asistentes con cuenta, historial y QR — ser dueño del fan. El puente de ahí a organizadores masivos todavía no está mapeado; es la siguiente pregunta grande, no la de hoy.

**No es fintech.** El cobro es un medio, no el producto.

## Operating Context

- **Descubrimiento y venta ocurren fuera del sitio.** El fan llega por un link de Instagram o WhatsApp, no navegando un catálogo. La home es un aterrizaje y una vitrina, no el canal de adquisición.
- **La compra es móvil y de una sentada**, muchas veces con datos móviles y de noche.
- **La puerta es el momento de verdad**: cientos de personas, red saturada, un portero con el celular en la mano. El escaneo bajó de ~6 s a ~40–200 ms optimizando el QR, no el decode.
- **Perú**: Yape y tarjeta vía Mercado Pago, soles, zona horaria de Lima.
- **El organizador reparte trabajo**: co-organizadores por marca o por evento, promotores con comisión/hitos, porteros por zona/puerta.
- **La operación del organizador es mensual y en Excel**: pago a promotores por recibo por honorarios, reporte los lunes/martes, export a Excel como entregable esperado.

## Capabilities and Constraints

**Ya construido:** eventos y publicación (revisión solo en la primera publicación), tipos de entrada incluyendo box, checkout invitado sin crear cuenta, pagos reales con Mercado Pago (3DS + PCI Secure Fields, verificado end-to-end en producción), QR rotativo firmado (ECDSA P-256, ventana de 10 s), reparto de entradas post-pago, wallet del asistente, favoritos, promotores con esquema de comisión por marca/evento/asignación, alta por link de grupo, equipo y co-organizadores, puertas/zonas, feed de escaneos en vivo, KPIs en tiempo real, vitrina pública de productora (`/[orgSlug]`), rutas SEO por categoría y ciudad, MCP server propio, bot de venta por WhatsApp (Kapso), i18n es/en.

**Reglas duras de arquitectura** (ver `AGENTS.md`, son vinculantes para cualquier trabajo de UI):
- El frontend **solo muestra**. Ninguna regla de negocio, ningún filtro por fecha, ningún `new Date()` fuera de un formatter. El `status` que manda el backend es la única fuente de verdad.
- **El dinero lo calcula el backend.** El cliente puede precalcular con el módulo compartido para feedback instantáneo, pero el `quote` del servidor pisa siempre. Divergencia = bug.
- `TicketType` es una **unión discriminada por `kind`**: un box tiene `seats` (personas que entran, se vende entero = 1 unidad), una entrada tiene `stock`. No existe `capacity` en el dominio.
- El QR se firma **una vez por ventana** de 10 s (la firma ECDSA no es determinística); el timer de 1 s solo actualiza el contador.

**Constraints técnicas:** Next.js con App Router (versión con breaking changes respecto al conocimiento previo — consultar `node_modules/next/dist/docs/`), Supabase (Auth + DB + RLS), React Query, Tailwind v4, `motion/react`, Radix como primitivo único de hojas/drawers, deploy en Vercel, dev con Turbopack. El proyecto Supabase remoto **no está en sync** con `supabase/migrations/`: toda migración necesita guards de existencia e idempotencia.

**Undecided:** el puente de nightlife a organizadores masivos; la reventa oficial con paso de pago y comisión (habilitada por el modelo de transferencia/claim actual, no construida); la "entrada en revisión" para pagos tardíos; el motor de señales anti-reventa (hoy solo defensa pasiva); los slugs en inglés de las rutas SEO vía `pathnames` de next-intl — hoy ambos locales usan el slug español, y hay que decidirlos **antes** de indexar.

## Brand Commitments

- **Nombre:** Pasape. "Tu pase a los eventos que valen la pena en Perú."
- **Voz:** español neutro peruano. Nada de coloquialismos fuertes — "pata" y similares están explícitamente fuera. El copy se explica solo: nada de jerga de producto ("precios escalonados", herencia/override) en superficies de organizador.
- **Símbolo:** la mascota asomándose por un contorno de puerta/ticket. Existe en variante para fondo claro (`public/icons/logo-badge-light.svg`) y como ícono PWA generado (`src/lib/seo/pwaIcon.tsx`). No hay app-icon cuadrado con gradiente oscuro: se probó y se descartó por leerse como generado por IA.
- **Compromiso antifraude:** bloquear poco, monitorear en silencio, aprender de la data antes de actuar. No se bloquea la reventa; se canaliza por transferencia oficial.

## Evidence on Hand

- `docs/a-quienes-nos-dirigimos-2026-07-15.md` — segmento objetivo con evidencia real y a quién NO se atiende primero.
- **Marco** (2026-07-14, contacto real): confirmó sin inducción que la barrera es de uso ("muchos no saben utilizar plataformas virtuales... por ello lo conllevan a utilizar Excel") y el dolor de "buscar un nombre en la libreta de 400". Validó que un cargo de servicio visible no le genera fricción a él, pero sí al comprador de varias entradas.
- **Fiesta Villana** (fiesta oficial de la UNFV): contacto entrante, 4 fechas al año, mismo perfil.
- **Vibration Lima Rave**: primer sí a una llamada de descubrimiento.
- **Piero**: operativa real de pago a promotores y reporte semanal; "venta directa + lista de invitados" descrito como el golazo.
- **Paula** (productora multi-marca): cliente correcto, **forma de producto equivocada** — se le mostró la forma ticketera-festival cuando ella opera nightlife (lista/box/carnet). Diagnóstico, no rechazo.
- **Carlos** (2026-07-22): tres dolores de operación en vivo — comunicación de staff, cashless, reputación de crew — fuera del alcance de ticketing.
- **Lucía** (piloto jul 2026): "el negro es lo que hace que el home se vea IA" — origen del giro a paleta clara. También reportó doble-tap en inputs.
- `docs/discovery-entrevistas-estado-2026-07-20.md`, `docs/mvp-whatsapp-promotores-2026-07-21.md`, `docs/finanzas.md`.

**No fabricar:** no hay clientes pagando en producción todavía, no hay testimonios publicables, no hay benchmarks de volumen, no hay caso de estudio. Ningún trabajo futuro debe inventar logos de clientes, cifras de entradas vendidas ni citas.

## Product Principles

1. **El wedge es la noche, el activo es el fan.** Cada decisión se juzga por si acerca a tener una base real de asistentes, no solo por si le gusta al organizador de hoy.
2. **Cero curva de aprendizaje.** El cliente objetivo abandonó otras plataformas por dificultad de uso. Un paso de más en el panel del organizador no es fricción: es la razón exacta por la que este segmento no usa ticketeras.
3. **El fan no pierde su entrada por un error nuestro ni suyo.** Sin cuenta obligatoria, entrega por varios canales, QR en pantalla, y la entrada disponible aunque no haya red.
4. **El backend decide, el frontend muestra.** Estados, dinero y disponibilidad nunca se infieren en el cliente.
5. **Hecho con criterio, no generado.** El producto debe leerse como construido por alguien que conoce la noche peruana — no como una plantilla. Es un criterio de aceptación, no un gusto.

## Accessibility & Inclusion

- **WCAG 2.2 AA es el piso**, no polish: contraste, tamaño de target y respeto a `prefers-reduced-motion` se tratan como bugs.
- **Enlace al Libro de Reclamaciones visible y accesible en el footer** — obligación de INDECOPI en Perú. Hoy queda tapado por el tabbar en móvil; es un defecto a corregir, no una decisión.
- **Funcionar con red mala o sin red en la puerta.** El escaneo y el acceso del fan a su entrada resuelven offline; ninguna superficie crítica del día del evento puede asumir conexión.
