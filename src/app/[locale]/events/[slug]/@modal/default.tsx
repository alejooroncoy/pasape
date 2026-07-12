// Fallback del slot @modal cuando no hay ruta interceptada activa (carga inicial,
// hard-nav o refresh): no se pinta ningún overlay. La ruta completa /buy renderiza
// por su cuenta en esos casos.
export default function ModalDefault() {
  return null;
}
