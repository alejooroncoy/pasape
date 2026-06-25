import { useState } from "react";
import { C } from "@/components/design/tokens";
import { useScannerSession } from "@/lib/scanning/hooks/useScannerSession";
import { ScanOnboarding } from "./ScanOnboarding";
import { ScanScreen } from "./ScanScreen";

// Router de la SPA del portero (sin Next router). Lee params de la URL una vez:
//   • `?door=CODE` (link compartido) → onboarding con el código precargado.
//   • `?event=<slug>` → exige sesión de portero activa (token) antes de escanear.
//   • sin nada → onboarding para ingresar el código a mano.
//
// Al canjear el código, en vez de navegar (`window.location`) actualizamos
// estado local con el eventSlug resuelto: una SPA no recarga.
function readParams() {
  const p = new URLSearchParams(window.location.search);
  return { eventSlug: p.get("event"), doorCode: p.get("door") };
}

export function App() {
  const initial = readParams();
  // eventSlug efectivo: el de la URL, o el que resolvió el join del onboarding.
  const [eventSlug, setEventSlug] = useState<string | null>(initial.eventSlug);

  const session = useScannerSession(eventSlug ?? "");

  // Sin evento aún: onboarding (con código precargado si vino del link).
  if (!eventSlug) {
    return (
      <ScanOnboarding
        initialCode={initial.doorCode ?? undefined}
        onJoined={(slug) => setEventSlug(slug)}
      />
    );
  }

  if (session.isLoading) {
    return <div style={{ minHeight: "100dvh", background: C.bg }} />;
  }

  // Sesión activa (token vigente) → a escanear. Si no, pedir el código.
  if (session.data?.active) return <ScanScreen eventSlug={eventSlug} />;
  return (
    <ScanOnboarding onJoined={(slug) => setEventSlug(slug)} />
  );
}
