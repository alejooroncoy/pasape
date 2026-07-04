# Finanzas de Pasape — modelo de comisión y rentabilidad

Última actualización: 2026-07-03.

## 1. Comisión de servicio (fee al comprador)

Implementada en `src/lib/tickets/serviceFee.ts`. Por tramos sobre el
subtotal de entradas de PAGO de la orden (no por entrada individual):

- **Piso: S/3** — cubre el costo fijo de Mercado Pago en entradas baratas.
- **Tramo 1 (S/0–S/300 de subtotal): 10%** flat.
- **Tramo 2 (más de S/300): 10% sobre los primeros S/300 (=S/30) + 5% solo
  sobre el excedente** (como tramo de impuesto, no sobre todo el monto).
- **Precio mínimo de venta: S/15** para cualquier entrada de pago (por
  debajo, el piso de S/3 sería una proporción absurda del precio). Entradas
  gratis no tienen mínimo ni fee.

Toggle por evento (`events.fee_mode`): el organizador elige si la comisión
la paga el comprador aparte (`buyer_pays_extra`, default) o si va incluida
en el precio que puso (`included_in_price`, la absorbe el organizador).

### Por qué el diseño es así

El costo real que Mercado Pago le cobra a Pasape (medido 2026-07-03 desde
el simulador "¿Cuánto quieres recibir?" de la cuenta de Pasape, igual para
tarjeta crédito/débito/Yape):

```
3.49% + S/1.00 + IGV(18%)  →  en soles, sobre el monto TOTAL cobrado (T):
costo_MP(T) ≈ 0.0412 × T + S/1.18
```

Un tope fijo (se probó primero con S/15) eventualmente lo supera cualquier
entrada lo bastante cara — el costo de MP crece proporcional al monto, sin
techo. Con 5% marginal en el tramo alto (siempre por encima del ~4.12% de
costo real), el margen de Pasape queda **positivo y creciente sin importar
el precio**, verificado hasta S/10,000+.

### Margen de Pasape por precio de entrada

| Precio entrada | Fee cobrado | Costo real de MP | Margen de Pasape |
|---|---|---|---|
| S/1 (bajo el mínimo, no vendible) | S/3 | ~S/1.34 | +S/1.66 |
| S/30 | S/3 | ~S/2.54 | +S/0.46 |
| S/50 | S/5 | ~S/3.45 | +S/1.55 |
| S/100 | S/10 | ~S/5.71 | +S/4.29 |
| S/150 | S/15 | ~S/7.98 | +S/7.02 |
| S/200 | S/20 | ~S/10.24 | +S/9.76 |
| S/300 | S/30 | ~S/14.15 | +S/15.85 |
| S/500 | S/40 | ~S/22.4 | +S/23.9 |
| S/1,000 | S/65 | — | +S/47.6 |
| S/3,000 | S/165 | ~S/131.5 | +S/33.5 |
| S/5,000 | S/265 | ~S/218 | +S/47 |
| S/10,000 | S/515 | ~S/434 | +S/81 |

## 2. Gasto mensual fijo (infra)

Datos del usuario, 2026-07-03. Tipo de cambio usado: **S/3.40 por USD**
(rango real visto: S/3.38–3.41).

| Servicio | USD/mes | Notas |
|---|---|---|
| Vercel | $20.00 | |
| Dominio | $2.17 | $26.08/año prorrateado ($2 el primer año) |
| Kapso WhatsApp | $25.00 | + $0.002/mensaje extra — despreciable al volumen actual (~$1-2/mes) |
| Supabase | $20.00 | |
| Sentry | $26.00 | |
| PostHog | $0.00 | Aún no activo, costo futuro por definir |
| **Total** | **≈$93.17/mes** | **≈ S/316.8/mes** |

No incluye: sueldo/tiempo del fundador (el objetivo actual es solo cubrir
infra, no pagarse — ver estrategia de bootstrapping), ni impuestos de
Pasape como negocio en Perú.

## 3. Rentabilidad — ¿cubre el gasto fijo?

Volumen esperado del piloto: **200 a 500 entradas de pago al mes** (dato
del usuario). Precios reales del piloto van de gratis a un máximo visto de
S/5,000 (outlier), con el "máximo promedio" típico rondando S/3,000.

**Precio promedio mínimo (breakeven) para cubrir S/316.8/mes de gasto fijo:**

| Volumen mensual | Precio promedio mínimo necesario |
|---|---|
| 200 entradas/mes | ~S/50-51 |
| 500 entradas/mes | ~S/33 |

**Conclusión:** si la mezcla real de ventas es mayoritariamente gratis o
muy barata (S/20-30), ese volumen **no alcanza a cubrir la infraestructura**.
Si hay algo de mezcla con entradas de S/50+ (generales de precio medio,
VIP, boxes), se cubre el gasto rápido — no en 3 meses, casi de inmediato.

**Pendiente de descubrir con el piloto:** qué tan cargada a "gratis/barato"
está la mezcla real de ventas — es la variable que más mueve el resultado,
más que el volumen total.

## 4. Historial de decisiones de esta sesión

1. Se detectó que el fee de "Servicio" (antes S/3 fijo hardcodeado en el
   frontend) nunca se cobraba de verdad — `orders.total_cents` solo era el
   subtotal de entradas, sin el fee. Se movió el cálculo al backend
   (fuente de verdad) y se sumó al monto realmente cobrado.
2. Se confirmó la tasa real de MP con el simulador de la cuenta (ver
   sección 1) y se descubrió que un fee fijo de S/15 tope perdía plata en
   entradas baratas (<~S/22) y caras (>~S/320).
3. Se agregó piso S/3 (resuelve baratas) y luego se cambió el tope fijo por
   un esquema de tramos con 5% marginal (resuelve caras, garantiza margen
   positivo para cualquier precio).
4. Se agregó precio mínimo de venta S/15 (evita fee desproporcionado tipo
   300% de recargo en una entrada de S/1).
5. Se agregó el toggle `fee_mode` por evento (aparte/incluido).
6. Investigación de mercado: ningún competidor conocido (Joinnus, Passline,
   Eventbrite, Ticketmaster) usa un esquema por tramos — todos son % plano
   o variable sin fórmula transparente. Pasape es competitivo, no hace
   falta subir el % base.
