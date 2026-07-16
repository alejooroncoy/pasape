import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/_shared/AuthContext";
import { supabaseOrganizationRepository } from "@/server/identity/organizations/infrastructure/repositories/SupabaseOrganizationRepository";
import { getOAuthClient } from "@/server/identity/oauth/application/GetOAuthClient";
import { Logo } from "@/components/brand/Logo";

// Pantalla de consentimiento de "Pasape MCP" (OAuth 2.1 para conectores
// remotos): acá es donde Claude.ai/Claude Desktop/Cursor mandan al navegador
// del organizador después de que pega la URL del MCP. Ruta SIN locale
// (`/oauth/authorize`, no `/[locale]/oauth/authorize`) porque la URL está
// fija en /.well-known/oauth-authorization-server — un cliente MCP no sabe
// de i18n. El copy va en español neutro directo (ver [[copy-tone]]).
type SearchParams = {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
};

const ErrorCard = ({ title, detail }: { title: string; detail: string }) => (
  <main className="home-light grid min-h-dvh place-items-center bg-cart-bg px-6 text-cart-ink">
    <div className="w-full max-w-[420px] rounded-2xl bg-cart-bg-elev p-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset]">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-cart-ink/70">{detail}</p>
    </div>
  </main>
);

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  if (sp.response_type !== "code" || !sp.client_id || !sp.redirect_uri || !sp.code_challenge) {
    return <ErrorCard title="Solicitud inválida" detail="Faltan parámetros de autorización." />;
  }
  if (sp.code_challenge_method && sp.code_challenge_method !== "S256") {
    return (
      <ErrorCard
        title="Método no soportado"
        detail="Solo se soporta PKCE con code_challenge_method=S256."
      />
    );
  }

  const client = await getOAuthClient(sp.client_id);
  if (!client || !client.redirectUris.includes(sp.redirect_uri)) {
    return (
      <ErrorCard
        title="Cliente no reconocido"
        detail="Esta app no está registrada o su redirect_uri no coincide."
      />
    );
  }

  const auth = await getAuthContext();
  if (!auth.ok) {
    const current = `/oauth/authorize?${new URLSearchParams(
      sp as Record<string, string>,
    ).toString()}`;
    redirect(`/es/org/login?next=${encodeURIComponent(current)}`);
  }

  const orgs = await supabaseOrganizationRepository.listByMember(auth.value.profileId);
  if (orgs.length === 0) {
    return (
      <ErrorCard
        title="Sin organización"
        detail="Necesitas ser parte de una organización en Pasape antes de conectar un asistente."
      />
    );
  }

  return (
    <main className="home-light grid min-h-dvh place-items-center bg-cart-bg px-6 py-12 text-cart-ink">
      <div className="w-full max-w-[440px] rounded-2xl bg-cart-bg-elev p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_20px_50px_-12px_rgba(124,58,237,0.45)]">
        <div className="mb-6 flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <span className="text-cart-ink/40">×</span>
          <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-sm font-semibold">
            {client.clientName.slice(0, 1).toUpperCase()}
          </span>
        </div>

        <h1 className="text-lg font-semibold leading-snug">
          {client.clientName} quiere conectarse a tu cuenta de Pasape
        </h1>
        <p className="mt-2 text-sm text-cart-ink/70">
          Podrá crear y editar eventos en nombre de la organización que elijas — como si lo
          hicieras vos desde el panel.
        </p>

        <form action="/api/oauth/consent" method="POST" className="mt-6 space-y-4">
          <input type="hidden" name="client_id" value={sp.client_id} />
          <input type="hidden" name="redirect_uri" value={sp.redirect_uri} />
          <input type="hidden" name="code_challenge" value={sp.code_challenge} />
          {sp.state ? <input type="hidden" name="state" value={sp.state} /> : null}

          <label className="block text-sm">
            <span className="mb-1.5 block text-cart-ink/60">Organización</span>
            <select
              name="organization_id"
              defaultValue={orgs[0].id}
              className="w-full rounded-lg border border-white/10 bg-cart-bg px-3 py-2.5 text-sm text-cart-ink outline-none focus:border-white/25"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              name="decision"
              value="deny"
              className="flex-1 rounded-lg border border-white/10 py-2.5 text-sm font-medium text-cart-ink/80 transition hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              name="decision"
              value="approve"
              className="flex-1 rounded-lg bg-[#7c3aed] py-2.5 text-sm font-semibold text-white transition hover:bg-[#6d28d9]"
            >
              Aprobar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
