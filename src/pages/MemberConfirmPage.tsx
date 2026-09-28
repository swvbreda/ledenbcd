import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { consumePostLoginPath } from "@/lib/postLoginPath";
import { memberPasswordlessEnabled } from "@/lib/memberAccessFlag";
import { requestMemberLoginLink } from "@/lib/memberLogin.functions";
import { Button } from "@/components/ui/button";

export default function MemberConfirmPage() {
  const navigate = useNavigate();
  const { user, linkedMemberId, loading: authLoading, isExtern, isAdmin, mfaStatus } = useAuth();
  const [hash, setHash] = useState("");
  const [tokenType, setTokenType] = useState<"magiclink" | "email">("magiclink");
  const [status, setStatus] = useState<"ready" | "verifying" | "checking" | "expired">("ready");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Fragment is not included in HTTP requests, Referrer, or server-rendered HTML.
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const value = fragment.get("token_hash");
    if (value && /^[a-f0-9]{64}$/i.test(value) && ["magiclink", "email"].includes(fragment.get("type") || "")) { setHash(value); setTokenType(fragment.get("type") as "magiclink" | "email"); }
    else setStatus("expired");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (status !== "checking" || authLoading) return;
    if (!user || isExtern || isAdmin || !linkedMemberId) {
      void supabase.auth.signOut().then(() => setStatus("expired"));
      return;
    }
    if (mfaStatus === "loading") return;
    if (mfaStatus !== "verified") { void navigate({ to: "/mfa-verify", replace: true }); return; }
    void navigate({ to: (consumePostLoginPath() || "/") as "/", replace: true });
  }, [status, authLoading, user, isExtern, linkedMemberId, isAdmin, mfaStatus, navigate]);

  async function confirm() {
    if (!memberPasswordlessEnabled || !hash || status !== "ready") return;
    setStatus("verifying");
    const result = await supabase.auth.verifyOtp({ token_hash: hash, type: tokenType });
    setHash("");
    if (result.error || !result.data.user) { setStatus("expired"); return; }
    // This only invokes the server-validated, verified-email linkage; the
    // AuthProvider refreshes the profile before we allow navigation.
    const { error } = await supabase.rpc("ensure_member_link");
    if (error) { await supabase.auth.signOut(); setStatus("expired"); return; }
    setStatus("checking");
  }

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    if (!memberPasswordlessEnabled) return;
    await requestMemberLoginLink({ data: { email } });
    setSent(true);
  }

  return <main className="min-h-screen flex items-center justify-center bg-background p-4">
    <div className="w-full max-w-sm space-y-4 border border-border bg-card p-6 rounded-md">
      <h1 className="text-2xl font-display font-bold">Ledenportaal</h1>
      {!memberPasswordlessEnabled ? <p className="text-muted-foreground">Deze inlogmethode is nog niet beschikbaar. Gebruik de bestaande inlogpagina.</p>
        : status === "ready" && hash ? <><p>Bevestig je e-mailadres om je ledenportaal te openen.</p><Button onClick={confirm}>Bevestig en open mijn ledenportaal</Button></>
        : status === "verifying" || status === "checking" ? <p>Beveiligde toegang controleren…</p>
        : <><p>Deze inloglink is verlopen of al gebruikt. Vraag eenvoudig een nieuwe aan.</p>
          {sent ? <p>Als dit adres toegang heeft, ontvang je een nieuwe inloglink.</p> :
            <form onSubmit={resend} className="space-y-3">
              <label htmlFor="member-email" className="block text-sm">E-mailadres</label>
              <input id="member-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full border border-input bg-background rounded-md p-2" />
              <Button type="submit">Stuur mij een nieuwe inloglink</Button>
            </form>}
        </>}
      <a href="/login" className="block text-sm text-primary">Terug naar inloggen</a>
    </div>
  </main>;
}
