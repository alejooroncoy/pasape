"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * `reducedMotion="user"` hace que TODOS los componentes de `motion/react`
 * respeten `prefers-reduced-motion` sin tocarlos uno por uno: desactiva
 * transform y layout (los que marean) y conserva las de opacidad, así el cambio
 * de estado se sigue viendo. Es el punto único: cualquier animación nueva del
 * producto queda cubierta desde el día uno.
 *
 * Lo que NO cubre son los avances automáticos de contenido (un carrusel que
 * cambia solo no es una animación, es contenido moviéndose): eso lo decide cada
 * componente con `useReducedMotion` — ver `FeaturedBanner`.
 */
export function MotionPreferences({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
