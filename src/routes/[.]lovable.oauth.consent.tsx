import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { savePostLoginPath } from "@/lib/postLoginPath";
import { Button } from "@/components/ui/button";

type OAuthResult = { data: any; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Koppeling toestaan — Ledenbestand BCD" },
      { name: "description", content: "Geef een externe assistent read-only toegang tot Ledenbestand BCD." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Ontbrekende of ongeldige autorisatieaanvraag.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      savePostLoginPath(location.pathname + location.searchStr);
      throw redirect({ to: "/login" });
    }
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error("Deze autorisatieaanvraag is verlopen of ongeldig.");
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? null };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <p role="alert" className="text-sm">Kon deze aanvraag niet laden: {error instanceof Error ? error.message : String(error)}</p>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = details?.client?.name ?? "Een externe app";
  const redirectUri = details?.redirect_uri ?? details?.client?.redirect_uri ?? null;
  const scopes = String(details?.scope ?? details?.scopes ?? "").split(/\s+/).filter(Boolean);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(approve ? "Toestaan mislukt. Probeer opnieuw." : "Weigeren mislukt. Probeer opnieuw."); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("Geen terugkeeradres ontvangen."); return; }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">{client} koppelen aan Ledenbestand BCD</h1>
        <p className="text-sm text-muted-foreground">Ingelogd als {email ?? "onbekend"}.</p>
        {redirectUri && <p className="text-xs text-muted-foreground break-all">Terugkeeradres: {redirectUri}</p>}
        <p className="text-sm">{client} kan hiermee alleen gegevens opzoeken (leden, vestigingen, projecten en taken) zolang je beheerder bent. Er kan niets worden gewijzigd.</p>
        {scopes.length > 0 && (
          <ul className="text-sm list-disc pl-5">
            {scopes.map((s) => (
              <li key={s}>{s === "openid" ? "Je identiteit bevestigen" : s === "email" ? "Je e-mailadres delen" : s === "profile" ? "Je basisprofiel delen" : `Extra toestemming: ${s}`}</li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Dit omzeilt de rechten en beveiliging van deze app niet.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decide(true)}>Toestaan</Button>
          <Button variant="outline" disabled={busy} onClick={() => decide(false)}>Koppeling annuleren</Button>
        </div>
      </div>
    </main>
  );
}
