import { HomeClient } from "./_home/HomeClient";
import { getSessionUser } from "@/server/identity/application/GetSessionUser";

// Server component: la sesión se resuelve en el server (sin flash) y baja al
// cliente como prop. El Nav solo necesita nombre + avatar para decidir entre
// "Ingresar" y el menú de cuenta.
export default async function HomePage() {
  const user = await getSessionUser();
  return (
    <HomeClient
      user={user ? { fullName: user.fullName, avatarUrl: user.avatarUrl } : null}
    />
  );
}
