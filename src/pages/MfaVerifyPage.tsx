import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { useAuth } from "@/hooks/useAuth";
import { Shield, LogIn, Mail, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";
import { hasPendingRedirect, maybeRedirectAfterLogin } from "@/lib/ssoRedirect";

type MfaMethod = "totp" | "email";

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const { user, markEmailMfaVerified, mfaStatus, loading: authLoading, isExtern } = useAuth();
  const [method, setMethod] = useState<MfaMethod>("totp");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState("");
  const [hasTotp, setHasTotp] = useState(true);
  const [emailSent, setEmailSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  useEffect(() => {
    if (!authLoading && user && mfaStatus === "verified") {
      if (hasPendingRedirect()) {
        void maybeRedirectAfterLogin();
      } else {
        navigate(isExtern ? "/extern" : "/", { replace: true });
      }
    }
  }, [authLoading, isExtern, mfaStatus, navigate, user]);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.find(f => f.status === "verified");
      if (totp) {
        setFactorId(totp.id);
        setHasTotp(true);
      } else {
        setHasTotp(false);
        setMethod("email");
      }
    });
  }, [navigate]);

  // Cooldown timer
  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setTimeout(() => setEmailCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Voer een 6-cijferige code in");
      return;
    }
    setLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      toast.error(challenge.error.message);
      setLoading(false);
      return;
    }
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verify.error) {
      toast.error("Ongeldige code. Probeer het opnieuw.");
      setCode("");
      setLoading(false);
      return;
    }
    if (await maybeRedirectAfterLogin()) return;
    navigate("/", { replace: true });
  };

  const handleSendEmailCode = async () => {
    if (!user?.email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      toast.error("Kon geen verificatiecode versturen. Probeer het later opnieuw.");
      return;
    }
    setEmailSent(true);
    setEmailCooldown(60);
    toast.success("Verificatiecode verstuurd naar " + user.email);
  };

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || code.length !== 6) return;
    setLoading(true);

    // Set flag before verifyOtp so onAuthStateChange picks it up
    markEmailMfaVerified();

    const { error } = await supabase.auth.verifyOtp({
      email: user.email,
      token: code,
      type: "email",
    });

    if (error) {
      // Remove the flag since verification failed
      if (user?.id) {
        try { localStorage.removeItem(`emfa_${user.id}`); } catch {}
      }
      toast.error("Ongeldige code. Controleer de code in je e-mail.");
      setCode("");
      setLoading(false);
      return;
    }

    toast.success("Verificatie geslaagd!");
    if (await maybeRedirectAfterLogin()) return;
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const switchMethod = (newMethod: MfaMethod) => {
    setMethod(newMethod);
    setCode("");
  };

  if (authLoading || mfaStatus === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
        <p className="text-sm text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
      <div className="w-full max-w-sm">
        <Card className="p-8">
          <div className="text-center mb-6">
            <img src={bcdLogo} alt="BCD" className="h-12 w-auto mx-auto mb-4" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-brand-red" />
              <h1 className="text-xl font-bold font-display">Verificatie vereist</h1>
            </div>
          </div>

          {/* Method toggle */}
          {hasTotp && (
            <div className="flex rounded-lg border mb-5 overflow-hidden">
              {hasTotp && (
                <button
                  type="button"
                  onClick={() => switchMethod("totp")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                    method === "totp"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5" />
                  App
                </button>
              )}
              <button
                type="button"
                onClick={() => switchMethod("email")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
                  method === "email"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                E-mail
              </button>
            </div>
          )}

          {/* TOTP method */}
          {method === "totp" && (
            <>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Voer de code uit je authenticator app in
              </p>
              <form onSubmit={handleTotpVerify} className="space-y-4">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  autoFocus
                />
                <Button type="submit" disabled={loading || code.length !== 6} className="w-full gap-2">
                  <LogIn className="h-4 w-4" />
                  {loading ? "Verifiëren..." : "Doorgaan"}
                </Button>
              </form>
              <button
                type="button"
                onClick={async () => {
                  // Use admin edge function to unenroll all TOTP factors (bypasses AAL2)
                  try {
                    await invokeWithAuth("reset-mfa", {});
                  } catch (e) {
                    console.error("reset-mfa error:", e);
                  }
                  // Clear email MFA marker too
                  if (user?.id) {
                    try { localStorage.removeItem(`emfa_${user.id}`); } catch {}
                  }
                  navigate("/mfa-setup", { replace: true });
                }}
                className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center"
              >
                Code kwijt? Opnieuw instellen
              </button>
            </>
          )}
          {/* Email method */}
          {method === "email" && (
            <>
              {!emailSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    We sturen een 6-cijferige code naar{" "}
                    <span className="font-medium text-foreground">{user?.email}</span>
                  </p>
                  <Button
                    onClick={handleSendEmailCode}
                    disabled={loading}
                    className="w-full gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {loading ? "Versturen..." : "Verstuur code"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Voer de code in die we naar <span className="font-medium text-foreground">{user?.email}</span> hebben gestuurd
                  </p>
                  <form onSubmit={handleEmailVerify} className="space-y-4">
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      className="text-center text-2xl tracking-[0.5em] font-mono"
                      autoFocus
                    />
                    <Button type="submit" disabled={loading || code.length !== 6} className="w-full gap-2">
                      <LogIn className="h-4 w-4" />
                      {loading ? "Verifiëren..." : "Doorgaan"}
                    </Button>
                  </form>
                  <button
                    type="button"
                    onClick={handleSendEmailCode}
                    disabled={emailCooldown > 0}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center disabled:opacity-50"
                  >
                    {emailCooldown > 0
                      ? `Nieuwe code versturen (${emailCooldown}s)`
                      : "Nieuwe code versturen"}
                  </button>
                </div>
              )}
            </>
          )}

          <div className="text-center mt-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                markEmailMfaVerified();
                toast.info("Verificatie overgeslagen. Dit is tijdelijk.");
                navigate("/", { replace: true });
              }}
              className="text-sm text-primary hover:text-primary/80 transition-colors block w-full"
            >
              Overslaan (tijdelijk)
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Uitloggen
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
