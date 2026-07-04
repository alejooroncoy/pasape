/**
 * Callback ref que enfoca el elemento al montar, PERO solo en punteros finos
 * (desktop con mouse/trackpad).
 *
 * Por qué: el `autoFocus` nativo enfoca el campo pero NO abre el teclado en
 * iOS/Android — WebKit/Blink bloquean el foco programático que no viene de un
 * gesto del usuario. Resultado en móvil: el input se ve "activo" (cursor puesto)
 * pero no se puede escribir hasta tocarlo, lo que se siente como "hay que tocar
 * dos veces". En desktop `autoFocus` sí funciona y ahorra un clic.
 *
 * Este ref replica el beneficio de `autoFocus` en desktop y lo desactiva en
 * táctil, donde solo estorbaba. Reemplaza `autoFocus` en inputs de cara al
 * usuario. Identidad estable (módulo) → React solo lo llama al montar/desmontar.
 *
 * Uso: <input ref={autoFocus ? focusOnDesktop : undefined} />
 */
export function focusOnDesktop(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") return;
  if (window.matchMedia("(pointer: fine)").matches) el.focus();
}
