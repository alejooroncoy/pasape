type JsonLdProps = {
  data: Record<string, unknown> | Record<string, unknown>[];
};

// Escapa la serialización JSON antes de inyectarla en <script>. Sin esto, un
// título/descripción de evento con `</script>` (controlado por el organizador)
// cierra el bloque y ejecuta script arbitrario en el navegador de CUALQUIER
// visitante de la página pública (stored XSS). Escapamos `<`, `>`, `&` y los
// separadores de línea U+2028/U+2029 (válidos en JSON pero rompen el <script>).
function safeJsonLd(data: JsonLdProps["data"]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(data) }}
    />
  );
}
