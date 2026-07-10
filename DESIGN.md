# Pasape · Sistema de diseño

Fuente de verdad visual de Pasape. Si un componente nuevo no encaja acá, se ajusta el token, no el componente suelto.

## Tesis

**La noche peruana, sin estafas.** Oscuro cálido (no negro puro, no violeta-degradado genérico), estructura de producto de eventos real (lista por fecha estilo Luma), con la precisión de Vercel: hairlines finísimos, ruido sutil, glow morado controlado y tipografía apretada. El morado es un **acento**, nunca relleno.

Lo que debe recordar quien entra: es de la noche, es peruano, y se siente hecho con criterio, no generado por IA.

## Por qué el look anterior se leía como IA (reglas duras)

El default de toda IA es: fondo casi-negro + violeta por todos lados + bordes redondeados suaves + grotesk bold centrado. Evitamos eso con:

- **Nada de blobs de gradiente radial fingiendo fotos.** Esta es la regla más importante y la que más se rompe por accidente. Cuando no hay una foto/flyer real de evento, la tentación es "simular" una con un radial-gradient morado-a-rosa tipo nebulosa. Ese blob es el tell #1 de IA hoy — más que el violeta, más que los bordes redondeados. Comparado con Luma real: su fondo y sus cards son **planos y sólidos, sin glow, sin ruido**. Si no hay foto real: usar **color sólido** (duotono oscuro por categoría), nunca un degradado radial que imite bokeh o iluminación de estudio.
- **Hairlines, no cajas.** Bordes de `1px` a `rgba(255,255,255,.09)`. Separan sin gritar.
- **Sin ruido/grano por defecto.** Se probó como "textura anti-IA" pero Luma tampoco lo usa — es otro efecto de más. Mantener superficies limpias.
- **Color como acento.** El morado vive en iconos de categoría, pills, el botón primario, metadatos mono. El fondo es neutro cálido y **plano**.
- **Tipografía apretada.** `letter-spacing` negativo (-0.02 a -0.045em), pesos 550-700, no black gritón.

## Color (tokens)

```css
:root{
  /* Base — oscuro cálido, no negro puro */
  --bg:#0a0a0b;
  --card:#161618;
  --card-2:#1c1c1f;

  /* Hairlines */
  --line:rgba(255,255,255,.09);
  --line-strong:rgba(255,255,255,.14);

  /* Texto */
  --tx:#f4f4f5;
  --tx-2:#a1a1a6;
  --tx-3:#6f6f76;

  /* Acento morado (marca) — usar como acento, no relleno */
  --acc:#8b5cf6;
  --acc-2:#a78bfa;
  --acc-deep:#6d28d9;

  /* Semánticos para pills/estado */
  --live:#f43f5e;
  --ok:#22c55e;
}
```

Colores de categoría (solo en el icono-tile, fondo al 15% de opacidad): Conciertos violeta `#8b5cf6`, Fiestas rosa `#ec4899`, Festivales naranja `#fb923c`, Comedia amarillo `#facc15`, Cultura cyan `#22d3ee`, Deportes lima `#a3e635`.

## Tipografía

- Familia: grotesk limpia y apretada (Geist / Inter / Helvetica Neue como fallback). Numérica tabular para horas y precios.
- Escala: H1 33px/700/-.035em · Título sección 19px/600/-.02em · Card title 17.5px/600/-.02em · Body 15px · Meta 13px · Mono 12.5px (fechas, GMT, metadatos técnicos).
- Mono para fechas y datos (`SÁB 11 JUL · 22:00`) — es el detalle "producto real" que evita lo genérico.

## Espaciado y forma

- Radios: cards 15px, tiles/thumbs 10-11px, pills 999px, botones 8-10px.
- Ancho de contenido: 960px (denso, tipo Luma), no 1200px.
- Gap de grillas 12-14px. Padding de card 16px.

## Componentes clave

1. **Fila de evento (firma del sistema).** Grid `1fr 108px`: izquierda hora + título + `Por [org]` + `📍 zona` + pills; derecha thumbnail cuadrado con degradado morado + ruido. Agrupadas bajo cabecera de día (`Hoy · Sábado`, `Vie 18 Jul`) con punto y línea hairline.
2. **Tile de categoría.** Icono de color (38px, fondo al 15%) + nombre + conteo. Card hairline, hover sube a `--card-2`.
3. **Pills de estado.** Entrada gratis (morado suave), Desde S/40 (gris), Últimas entradas (rojo suave), En vivo (rojo con punto).
4. **Tarjeta de ciudad (sidebar).** Header con glow morado + ruido, nombre, copy corto, botón "Seguir", mini-mapa con pines de conteo.
5. **Botón primario.** Morado con highlight interno (`inset 0 0 0 1px rgba(255,255,255,.12)`) y sombra de glow `0 8px 22px rgba(124,60,237,.35)`. Ghost: `--card` + `--line-strong`.
6. **Nav.** Sticky, `backdrop-filter: blur(14px)`, borde inferior hairline. Hora GMT en mono a la derecha (detalle Luma).

## Motion

- Transiciones 140-160ms en hover (borde a `--line-strong`, fondo a `--card-2`, translateY -2px en cards).
- Nada de animaciones de entrada llamativas. La quietud es parte de la elegancia. Respetar `prefers-reduced-motion`.

## Referencias

Luma (`luma.com/discover`) para estructura de lista y descubrimiento. Vercel para precisión de hairlines/ruido/glow. Mockup aprobado: dirección "estilo Luma" + artesanía "Vercel-dark".
