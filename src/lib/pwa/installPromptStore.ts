// Store módulo-scoped (no React) para el evento `beforeinstallprompt`. Necesario
// porque el evento puede disparar antes de que /order o /tickets/[id] monten su
// InstallNudge — capturarlo en un listener global (InstallPromptListener, montado
// en el layout raíz) y guardarlo acá es la única forma de no perderlo.
type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export function setDeferredPrompt(e: BeforeInstallPromptEvent | null) {
  deferred = e;
  emit();
}

export function setInstalled(v: boolean) {
  installed = v;
  emit();
}

export function getDeferredPrompt() {
  return deferred;
}

export function getInstalled() {
  return installed;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
