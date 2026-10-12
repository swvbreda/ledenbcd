import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { savePostLoginPath } from "@/lib/postLoginPath";
import { isAllowedAudience, isValidChallenge, isValidState } from "@/lib/adviesEligibility";
import { issueAdviesCode } from "@/lib/adviesEligibility.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/adviespakket-controle")({
  head: () => ({
    meta: [
      { title: "Ledencontrole adviespakket — BCD" },
      { name: "description", content: "Bevestig je BCD-lidmaatschap voor een adviespakket, zonder gegevens te delen." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Ledencontrole adviespakket — BCD" },
      { property: "og:description", content: "Bevestig je BCD-lidmaatschap voor een adviespakket, zonder gegevens te delen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdviesControlePage,
});

type Params = { challenge: string; state: string; audience: string };

function readParams(): Params | null {
  const q = new URLSearchParams(window.location.search);
  const p = { challenge: q.get("code_challenge"), state: q.get("state"), audience: q.get("audience") };
  if (q.get("code_challenge_method") !== "S256") return null;
  if (!isValidChallenge(p.challenge) || !isValidState(p.state) || !isAllowedAudience(p.audience)) return null;
  return p as Params;
}

function AdviesControlePage() {
  const { user, loading } = useAuth();
  const issue = useServerFn(issueAdviesCode);
  const [params, setParams] = useState<Params | null | undefined>(undefined);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

  useEffect(() => setParams(readParams()), []);

  const goLogin = () => savePostLoginPath(window.location.pathname + window.location.search);

  const confirm = async () => {
    if (!params || sent.current) return;
    if (!window.opener) { setMsg("Open deze pagina via de knop op de website van Het Strategiebureau."); return; }
    setBusy(true);
    try {
      const r = await issue({ data: { challenge: params.challenge, method: "S256", audience: params.audience } });
      if (!r.ok) {
        setMsg(r.reason === "not_eligible" ? "Voor dit account is geen actief BCD-lidmaatschap gevonden."
          : r.reason === "rate_limited" ? "Te veel pogingen. Probeer het over enkele minuten opnieuw."
          : "De controle kon niet worden uitgevoerd. Probeer het opnieuw.");
        return;
      }
      sent.current = true;
      // Uitsluitend code + state, uitsluitend naar de exacte bureau-origin.
      window.opener.postMessage({ type: "bcd-eligibility", code: r.code, state: params.state }, params.audience);
      setMsg("Bevestigd. Je kunt dit venster sluiten.");
      setTimeout(() => window.close(), 800);
    } catch {
      setMsg("De controle kon niet worden uitgevoerd. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4 rounded-lg border border-border p-6">
        <h1 className="font-display text-xl uppercase">Ledencontrole adviespakket</h1>
        {params === undefined || loading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : params === null ? (
          <p className="text-sm text-destructive">Ongeldige of onvolledige aanvraag.</p>
        ) : !user ? (
          <>
            <p className="text-sm text-muted-foreground">Log in met je BCD-account om je lidmaatschap te bevestigen.</p>
            <Button asChild onClick={goLogin}><Link to="/login">Inloggen</Link></Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Het Strategiebureau ({new URL(params.audience).host}) vraagt alleen óf je actief BCD-lid bent.
              Je e-mail, contact- en ledengegevens worden niet gedeeld.
            </p>
            <Button onClick={confirm} disabled={busy || sent.current}>Lidmaatschap bevestigen</Button>
          </>
        )}
        {msg && <p className="text-sm" role="status">{msg}</p>}
      </div>
    </main>
  );
}
