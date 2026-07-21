# Estado de la campaña de discovery — 20 jul 2026

## Contexto / decisión de fondo

El módulo de ticketing de Pasape llegó a un mercado saturado — probablemente un
error de timing entrar por ahí como "otro QR más". Esto **no es abandonar
Pasape como proyecto/visión**: el ticketing queda publicado y disponible (por
si alguien se suma o lo prueba), pero **sin más código nuevo** hasta que estas
entrevistas revelen el dolor operativo real que valga la pena construir. Todo
el esfuerzo activo va a esta campaña.

Importante: esta conclusión sobre el mercado se tomó **antes** de hacer una
sola entrevista — hay que dejar que las conversaciones reales la confirmen o
la corrijan, no darla por sentada.

## Objetivo de las entrevistas

Encontrar el dolor operativo real de productoras/organizadores de eventos en
LatAm, vía llamadas de 20 min estilo Mom Test (comportamiento pasado, no
opiniones). **Regla número uno: escuchar más que seguir el guion** — si la
persona se engancha contando algo que le duele, quedarse ahí, no cortar para
volver al orden de preguntas.

- Guía completa de la llamada: ver artifact/scratchpad de la sesión —
  apertura + 3 bloques (cómo operan hoy / dolor específico / validación de
  gasto) + cierre con pedido de referidos. Foco de profundización si sale:
  trazabilidad de promotor, boxes, lista de invitados, anti-reventa (ahí es
  donde Pasape ya tiene diferenciación real, no en ticketing genérico).

## Lista de prospectos

Artifact publicado (fuente de verdad de la lista completa, correos y
celulares verificados):
**https://claude.ai/code/artifact/20a63eff-7e23-44bc-a87e-ec550428a651**

- **50 contactos activos** en productoras de eventos LatAm (Perú, Chile,
  Argentina, Colombia, México, Ecuador, España), levantados a mano vía
  LinkedIn, priorizados en 3 tiers (alta/media/baja) por poder de decisión +
  rol operativo + facilidad de conversión.
- **3 descartados** por ser rol de ticketera pura (Ticketmaster, Superstruct
  Ticketing) — fuera del pool activo a propósito.
- **13 correos + 4 celulares verificados** vía Apollo.io (cruce manual, sin
  bulk-match — la cuenta es Free plan y no da acceso a esa API).
- **4 prospectos nuevos** (fuera de los 50 originales) descubiertos como
  "personas similares" en Apollo mientras se buscaba a los ya contactados,
  con correo y celular ya verificados, listos para outreach directo sin pasar
  por LinkedIn: Karla Azpe Zepeda (OCESA), Dante Quercia (Lotus), Gabriela
  Lagos Munoz (GL events Chile), Claudia Perdomo (PROCOLOMBIA, adyacente).

## Estado de LinkedIn (solicitudes de conexión)

De los 50: **40 contactados** (solicitud de conexión enviada, sin nota).
Quedan **11 sin contactar**:

No-adyacentes (prioridad media-alta): Camila Hockenheimer, Marcia Caro Olave,
César Lozano, Enrique Battilana.

Adyacentes (prioridad baja): Felipe Ojeda Reveco, Carlos Garbagna, Silvana
Sanches Nakayama, Diego Ibáñez Sánchez, Alicia Norero Fernández, Edwin
Betancur, Anamaria Zarta Monroy.

## Estado de mensajes (ya conectados)

Aceptaron conexión y **ya se les mandó el mensaje** de propuesta de llamada
(estudio independiente, 20 min, sin pitch):

1. Kimberly Mas Risso — Bizarro Live (Perú)
2. Manuel Campusano Kellet — Prisamedia Chile
3. Victor Balabarca Saavedra — +700 eventos PE/CL/AR
4. Valeria Leguizamon — Coordinadora Producción Senior (⚠ verificar si es la
   misma persona del correo de Apollo — LinkedIn la ubica en Argentina, el
   correo de Apollo es de Corferias en Bogotá)
5. Ailin Quijano Lopez — Estratega Comunicación/Marketing
6. Roberto Kharlos Aquije Del Aguila — Head BTL, Bizarro
7. Luciana Cristofoli — Marketing/Comunicación/Prensa, DF Entertainment

**Pendiente de seguimiento:** revisar periódicamente quién más de los 40
acepta la conexión y mandarle el mensaje (mismo patrón: chequear si ya tiene
mensaje antes de reenviar, personalizar por rol/empresa, saludo según hora
real del destinatario — ver nota de horario abajo).

## Nota operativa: hora del destinatario antes de escribir

Antes de mandar cualquier mensaje nuevo, conseguir la hora real de Perú del
navegador (`new Date().toLocaleTimeString('en-GB', {hour12:false})` —
siempre `hour12:false`, si no puede leerse mal por 12h) y aplicar los
offsets GMT fijos por país (Perú/Colombia/Ecuador GMT-5, México GMT-6, Chile
GMT-4, Argentina/Brasil GMT-3, España GMT+2 en julio) para no escribir fuera
de horario laboral (~9am–7pm) ni con el saludo equivocado (Buenos
días/tardes/noches). No usar APIs externas de hora (WebFetch/WebSearch tienen
caché y dieron resultados desfasados en pruebas).

## Próximos pasos

1. Seguir revisando aceptaciones de LinkedIn y mandando el mensaje a quien
   falte.
2. Decidir si se manda el batch 3 restante (11 pendientes) o se prioriza
   primero conseguir llamadas con los que ya aceptaron.
3. En cuanto caiga la primera llamada: usar la guía, priorizar escuchar sobre
   completar preguntas, anotar montos concretos de plata/tiempo perdido
   (señal de dolor real más confiable).
4. Sintetizar hallazgos de las llamadas para confirmar o refutar la hipótesis
   de que el dolor real está en trazabilidad de promotor/box/lista/anti-reventa,
   no en ticketing genérico.
