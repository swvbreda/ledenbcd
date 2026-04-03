import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, CheckCircle2, Smartphone, ArrowRight, ExternalLink, Copy, Check, Mail, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";

const AUTHENTICATOR_APPS = [
  {
    name: "Google Authenticator",
    ios: "https://apps.apple.com/app/google-authenticator/id388497605",
    android: "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2",
  },
  {
    name: "Microsoft Authenticator",
    ios: "https://apps.apple.com/app/microsoft-authenticator/id983156458",
    android: "https://play.google.com/store/apps/details?id=com.azure.authenticator",
  },
  {
    name: "Authy",
    ios: "https://apps.apple.com/app/authy/id494168017",
    android: "https://play.google.com/store/apps/details?id=com.authy.authy",
  },
];

type SetupMethod = "choose" | "totp" | "email";

export default function MfaSetupPage() {
  const { user, markEmailMfaVerified } = useAuth();
  const navigate = useNavigate();
  const [setupMethod, setSetupMethod] = useState<SetupMethod>("choose");

  // TOTP state
  const [totpStep, setTotpStep] = useState(1);
  const [qrUri, setQrUri] = useState("");
  const [factorId, setFactorId] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);

  // Email state
  const [emailSent, setEmailSent] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Cooldown timer for email
  const startCooldown = () => {
    setEmailCooldown(60);
    const interval = setInterval(() => {
      setEmailCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const enrollFactor = async () => {
    setEnrolling(true);
    // Use admin edge function to remove all existing TOTP factors (bypasses AAL2 requirement)
    try {
      const { error: resetError } = await supabase.functions.invoke("reset-mfa");
      if (resetError) {
        console.error("reset-mfa error:", resetError);
      }
    } catch (e) {
      console.error("Failed to call reset-mfa:", e);
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator App",
      issuer: "leden.coffeeshopbond.nl",
    });
    if (error) {
      toast.error("Kon verificatie niet instellen. Probeer het opnieuw.");
      setEnrolling(false);
      return;
    }
    setQrUri(data.totp.qr_code);
    setFactorId(data.id);
    setSecret(data.totp.secret);
    setEnrolling(false);
  };

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTotpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { toast.error("Voer een 6-cijferige code in"); return; }
    setLoading(true);
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) { toast.error(challenge.error.message); setLoading(false); return; }
    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code,
    });
    if (verify.error) {
      toast.error("Ongeldige code. Controleer of je de juiste code hebt ingevoerd.");
      setCode("");
      setLoading(false);
      return;
    }
    toast.success("Dubbele verificatie is ingesteld!");
    navigate("/");
  };

  const goToTotpStep2 = () => {
    setTotpStep(2);
    enrollFactor();
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
    startCooldown();
    toast.success("Verificatiecode verstuurd naar " + user.email);
  };

  const handleEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || code.length !== 6) return;
    setLoading(true);

    markEmailMfaVerified();

    const { error } = await supabase.auth.verifyOtp({
      email: user.email,
      token: code,
      type: "email",
    });

    if (error) {
      if (user?.id) {
        try { localStorage.removeItem(`emfa_${user.id}`); } catch {}
      }
      toast.error("Ongeldige code. Controleer de code in je e-mail.");
      setCode("");
      setLoading(false);
      return;
    }

    toast.success("E-mail verificatie ingesteld!");
    navigate("/", { replace: true });
  };

  if (!user) return null;

  // Step indicator for TOTP flow
  const totalSteps = 3;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50 overflow-y-auto">
      <div className="w-full max-w-md my-8">
        <Card className="p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <img src={bcdLogo} alt="BCD" className="h-10 w-auto mx-auto mb-3" />
            <div className="flex items-center justify-center gap-2 mb-1">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold font-display">Extra beveiliging instellen</h1>
            </div>
          </div>

          {/* Choose method */}
          {setupMethod === "choose" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Kies hoe je je account extra wilt beveiligen bij het inloggen.
              </p>

              <button
                type="button"
                onClick={() => setSetupMethod("totp")}
                className="w-full border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Authenticator app</p>
                    <p className="text-xs text-muted-foreground">
                      Google Authenticator, Microsoft Authenticator of Authy
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSetupMethod("email")}
                className="w-full border rounded-lg p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">E-mail verificatie</p>
                    <p className="text-xs text-muted-foreground">
                      Ontvang een code op {user.email}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary" />
                </div>
              </button>

              <div className="pt-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    markEmailMfaVerified();
                    toast.info("MFA overgeslagen. Je kunt dit later alsnog instellen via je account.");
                    navigate("/", { replace: true });
                  }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center"
                >
                  Later instellen →
                </button>
              </div>
            </div>
          )}

          {/* Email setup */}
          {setupMethod === "email" && (
            <div className="space-y-4">
              {!emailSent ? (
                <>
                  <div className="text-center">
                    <Mail className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="font-semibold text-base mb-1">E-mail verificatie</h2>
                    <p className="text-sm text-muted-foreground">
                      Bij elke login sturen we een 6-cijferige code naar{" "}
                      <span className="font-medium text-foreground">{user.email}</span>.
                      Verstuur nu een testcode om te bevestigen dat het werkt.
                    </p>
                  </div>
                  <Button onClick={handleSendEmailCode} disabled={loading} className="w-full gap-2">
                    <Mail className="h-4 w-4" />
                    {loading ? "Versturen..." : "Verstuur testcode"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setSetupMethod("choose"); setCode(""); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center"
                  >
                    ← Terug naar keuze
                  </button>
                </>
              ) : (
                <>
                  <div className="text-center">
                    <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="font-semibold text-base mb-1">Voer de code in</h2>
                    <p className="text-sm text-muted-foreground">
                      Vul de 6-cijferige code in die we naar je e-mail hebben gestuurd.
                    </p>
                  </div>
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
                      {loading ? "Verifiëren..." : "Bevestigen"}
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
                </>
              )}
            </div>
          )}

          {/* TOTP setup */}
          {setupMethod === "totp" && (
            <>
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                        totpStep === s
                          ? "bg-primary text-primary-foreground"
                          : totpStep > s
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {totpStep > s ? <Check className="h-3.5 w-3.5" /> : s}
                    </div>
                    {s < 3 && <div className={`w-8 h-0.5 ${totpStep > s ? "bg-primary/40" : "bg-muted"}`} />}
                  </div>
                ))}
              </div>

              {/* Step 1: Download app */}
              {totpStep === 1 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <Smartphone className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="font-semibold text-base mb-1">Stap 1: Download een authenticator app</h2>
                    <p className="text-sm text-muted-foreground">
                      Kies een van onderstaande apps en installeer deze op je telefoon.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {AUTHENTICATOR_APPS.map((app) => (
                      <div key={app.name} className="border rounded-lg p-3">
                        <p className="font-medium text-sm mb-1.5">{app.name}</p>
                        <div className="flex gap-2">
                          <a href={app.ios} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            iPhone <ExternalLink className="h-3 w-3" />
                          </a>
                          <a href={app.android} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            Android <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Heb je al een authenticator app? Dan kun je direct door naar de volgende stap.
                  </p>
                  <Button onClick={goToTotpStep2} className="w-full gap-2">
                    Ik heb een app <ArrowRight className="h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setSetupMethod("choose"); setCode(""); }}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center"
                  >
                    ← Terug naar keuze
                  </button>
                </div>
              )}

              {/* Step 2: Scan QR code */}
              {totpStep === 2 && (
                <div className="space-y-4">
                  {enrolling ? (
                    <p className="text-center text-sm text-muted-foreground py-8">Even laden...</p>
                  ) : (
                    <>
                      <div className="text-center">
                        <h2 className="font-semibold text-base mb-1">Stap 2: Koppel de app</h2>
                        <p className="text-sm text-muted-foreground">
                          Open je authenticator app en scan onderstaande QR-code.
                        </p>
                      </div>
                      <div className="flex justify-center">
                        {qrUri && (
                          <img src={qrUri} alt="QR Code" className="w-44 h-44 rounded-lg border p-1 bg-white" />
                        )}
                      </div>
                      {secret && (
                        <div className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1.5">
                            Lukt het scannen niet? Voer deze code handmatig in:
                          </p>
                          <div className="flex items-center justify-center gap-2">
                            <code className="text-xs font-mono bg-background px-2 py-1 rounded border select-all break-all">
                              {secret}
                            </code>
                            <button type="button" onClick={handleCopySecret}
                              className="text-muted-foreground hover:text-primary transition-colors p-1" title="Kopieer code">
                              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      )}
                      <Button onClick={() => setTotpStep(3)} className="w-full gap-2">
                        Ik heb de code gescand <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Step 3: Verify */}
              {totpStep === 3 && (
                <div className="space-y-4">
                  <div className="text-center">
                    <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
                    <h2 className="font-semibold text-base mb-1">Stap 3: Bevestig de koppeling</h2>
                    <p className="text-sm text-muted-foreground">
                      Vul de 6-cijferige code in die nu in je authenticator app staat.
                    </p>
                  </div>
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
                      <CheckCircle2 className="h-4 w-4" />
                      {loading ? "Verifiëren..." : "Beveiliging activeren"}
                    </Button>
                  </form>
                  <button type="button" onClick={() => setTotpStep(2)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center">
                    ← Terug naar QR-code
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
