# Pasape · Sistema de diseño

Fuente de verdad visual de Pasape. Si un componente nuevo no encaja acá, se ajusta el token, no el componente suelto.

## Tesis

**La noche peruana, sin estafas.** No negro puro, no violeta-degradado genérico, no "se ve hecho por IA". El feedback que originó el giro a claro (Lucía, piloto jul 2026): *"el negro es lo que hace que el home se vea IA"*. Fondo claro cálido con sesgo morado en los neutros (no gris genérico), acento morado/azul contenido, tipografía apretada, hairlines finísimos. El morado es un **acento**, nunca relleno.

Lo que debe recordar quien entra: es de la noche, es peruano, y se siente hecho con criterio, no generado por IA.

## Un solo sistema de tokens, dos escalas por scope

No hay "modo claro" y "modo oscuro" como temas intercambiables — hay **un** set de custom properties (`--color-cart-*`, definidas en `src/app/globals.css` dentro de `@theme`) que una clase de scope reescribe:

- **Default (sin scope)** = oscuro. Es el valor base de `--color-cart-*` en `@theme`.
- **`.home-light`** = reescribe `--color-cart-*` a la escala clara dentro de ese subárbol. Se aplica como wrapper en el root de cada superficie ya migrada.
- **`.cart-dark-scope`** = dentro de un árbol `.home-light`, vuelve a lo oscuro para una excepción puntual (ej. footer, detalle de QR).

Como son las mismas variables (no un namespace paralelo), un componente escrito con clases `bg-cart-bg text-cart-ink border-cart-line` **hereda automáticamente** la escala correcta según en qué scope viva — no hay que tocar el componente, solo envolver la superficie en `.home-light` (o no).

**Regla práctica:** nunca se inventa un color nuevo para "la versión clara" de algo. Se usa el token `cart-*` que ya existe; si no alcanza, se agrega una variante del token en el bloque `.home-light` de `globals.css`, no un valor suelto en el componente.

## Color (tokens reales, `src/app/globals.css`)

```css
/* Default — oscuro (@theme, sin scope) */
--color-cart-bg: #0a0a0f;
--color-cart-bg-elev: #12121a;
--color-cart-ink: #ffffff;
--color-cart-ink-2: #d6d6e0;
--color-cart-ink-3: #8e8ea1;
--color-cart-ink-4: #5e5e70;
--color-cart-line: rgba(255,255,255,.08);
--color-cart-line-strong: rgba(255,255,255,.14);
--color-cart-accent: #b87cff;

/* .home-light — reescribe lo anterior dentro del scope */
--color-cart-bg: #fbfaff;
--color-cart-bg-elev: #f3f1fb;
--color-cart-bg-elev-2: #ece8f9;
--color-cart-ink: #141026;      /* ~15:1 sobre el bg */
--color-cart-ink-2: #363050;    /* ~10:1 */
--color-cart-ink-3: #4f4870;    /* ~7:1 — secundario, sigue AA */
--color-cart-ink-4: #6a6488;    /* ~5:1 — hints/placeholder */
--color-cart-line: rgba(28,20,60,.12);
--color-cart-line-strong: rgba(28,20,60,.2);
--color-cart-accent: #7c3aed;
--color-cart-accent-2: #4f6df5;  /* azul secundario, no solo morado */
```

Colores de categoría (icono-tile, fondo al 15% de opacidad) — vigentes en ambos scopes: Conciertos violeta `#8b5cf6`, Fiestas rosa `#ec4899`, Festivales naranja `#fb923c`, Comedia amarillo `#facc15`, Cultura cyan `#22d3ee`, Deportes lima `#a3e635`.

**Contraste — regla dura:** `cart-ink` y `cart-ink-2` son para texto de lectura (título/body); `cart-ink-3` es el piso para texto secundario que siga siendo AA; `cart-ink-4` es SOLO para hints/placeholders/metadata decorativa — nunca para el mensaje principal de una pantalla ni para un error/aviso que el usuario deba leer.

## Tipografía

- Familia: grotesk limpia y apretada (Geist / Inter / Helvetica Neue como fallback). Numérica tabular para horas y precios.
- Escala: H1 33px/700/-.035em · Título sección 19px/600/-.02em · Card title 17.5px/600/-.02em · Body 15px · Meta 13px · Mono 12.5px (fechas, GMT, metadatos técnicos).
- Mono para fechas y datos (`SÁB 11 JUL · 22:00`) — es el detalle "producto real" que evita lo genérico.

## Espaciado y forma

- Radios: cards 15-16px, tiles/thumbs 10-11px, pills 999px, botones 8-10px (CTAs grandes hasta 28px).
- Ancho de contenido: 960-1180px según superficie (denso, no 1200px de sobra).
- Gap de grillas 12-14px. Padding de card 16px.

## Qué evitar (por qué el look anterior se leía como IA)

- **Nada de blobs de gradiente radial fingiendo fotos.** Si no hay foto/flyer real: color sólido (duotono por categoría), nunca un degradado radial imitando bokeh/estudio.
- **Hairlines, no cajas.** Bordes finísimos (`cart-line`), no bordes gruesos que griten.
- **Ruido/grano solo donde ya está decidido** (`.cart-grain`, más sutil en `.home-light`) — no agregarlo como "textura anti-IA" en superficies nuevas.
- **Color como acento**, nunca relleno de fondo — el morado vive en iconos, pills, CTA primario, no en el fondo general.
- **Tipografía apretada**, `letter-spacing` negativo, sin black gritón.

## Estado de la migración clara — qué ya está y qué falta

El giro a `.home-light` es progresivo, no un rediseño de un solo commit. Estado real (jul 2026):

**Ya en `.home-light`:** home (`_home/HomeClient.tsx`), menú lateral (`SideDrawer.tsx`), detalle de evento (`events/[slug]/EventDetailClient.tsx`), checkout (`buy/page.tsx`, `PayDrawer.tsx`), tickets/favoritos/perfil (`tickets/layout.tsx`, `favorites/layout.tsx`, `profile/layout.tsx`), y los drawers del consumidor sobre el primitivo único de hoja Radix (`SignInDrawer`, compartir-evento).

**Excepción intencional (`cart-dark-scope`), no pendiente:** detalle de QR (`tickets/[id]`) y `tickets/past` — un ticketing real (Joinnus/Ticketmaster) usa fondo oscuro para el QR por legibilidad de escaneo; no es deuda, es decisión de producto.

**Pendiente (oscuro por defecto, sin scope — deuda de migración, no diseño intencional):**
- `/org/*` — panel del organizador completo (`OrgShell.tsx` es el wrapper único: envolverlo en `.home-light` cascada casi todo el panel sin tocar cada pantalla).
- `/promo/*` — superficie de promotores.
- `/login` de página completa y `/org/login` (solo el `SignInDrawer` portal-mounted ya migró, no la página standalone).

**Al migrar una superficie nueva:** envolver el layout/shell raíz en `.home-light`, correr el flujo completo en el navegador, y cazar hardcodes que peleen con el cascade — `text-white` literal, glows/gradientes calibrados para fondo oscuro, o cualquier color que no sea un token `cart-*`. Esos son los que rompen el contraste, no el mecanismo del scope.

## Componentes clave

1. **Fila de evento (firma del sistema).** Grid `1fr 108px`: izquierda hora + título + `Por [org]` + `📍 zona` + pills; derecha thumbnail cuadrado con degradado morado + ruido. Agrupadas bajo cabecera de día (`Hoy · Sábado`, `Vie 18 Jul`) con punto y línea hairline.
2. **Tile de categoría.** Icono de color (38px, fondo al 15%) + nombre + conteo. Card hairline, hover sube a `cart-bg-elev`.
3. **Pills de estado.** Entrada gratis (morado suave), Desde S/40 (gris), Últimas entradas (rojo suave), En vivo (rojo con punto).
4. **Sheet/drawer único (Radix).** Un solo primitivo (`src/components/ui/Sheet.tsx`) para todos los drawers del consumidor — bottom-sheet en mobile, side-sheet en desktop. Scrim centralizado (`.app-scrim`, `--overlay-scrim`), un solo estilo en todo el producto.
5. **Botón primario.** Morado con highlight interno (`inset 0 0 0 1px rgba(255,255,255,.12)`) y sombra de glow. Ghost: `cart-bg-elev` + `cart-line-strong`.
6. **Nav / OrgShell.** Sticky, `backdrop-filter: blur(14px)`, borde inferior hairline. Hora GMT en mono a la derecha (detalle Luma) donde aplica.

## Motion

- Transiciones 140-160ms en hover (borde a `cart-line-strong`, fondo a `cart-bg-elev`, translateY -2px en cards).
- Nada de animaciones de entrada llamativas. La quietud es parte de la elegancia. Respetar `prefers-reduced-motion`.
- `.home-wash` (drift ambiental sutil, no blob duro) reemplaza cualquier glow radial fingiendo foto — inspirado en Partiful, muy bajo contraste, movimiento lento.

## Referencias

Luma (`luma.com/discover`) para estructura de lista y descubrimiento. Vercel para precisión de hairlines/ruido/glow. Joinnus/Teleticket/Ticketmaster para el patrón "footer/QR oscuro aunque la página sea clara".
