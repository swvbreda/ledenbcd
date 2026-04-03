import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, CheckCircle2, Smartphone, ArrowRight, ExternalLink, Copy, Check } from "lucide-react";
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

export default function MfaSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [qrUri, setQrUri] = useState("");
  const [factorId, setFactorId] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [copied, setCopied] = useState(false);

  const enrollFactor = async () => {
    setEnrolling(true);

    // First check if a factor already exists (handle name conflict)
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const existingTotp = factors?.totp?.find(f => f.status === "unverified");
    if (existingTotp) {
      // Unenroll unverified factor first to avoid name conflict
      await supabase.auth.mfa.unenroll({ factorId: existingTotp.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator App",
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

  const handleVerify = async (e: React.FormEvent) => {
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
      toast.error("Ongeldige code. Controleer of je de juiste code hebt ingevoerd.");
      setCode("");
      setLoading(false);
      return;
    }
    toast.success("Dubbele verificatie is ingesteld!");
    navigate("/");
  };

  const goToStep2 = () => {
    setStep(2);
    enrollFactor();
  };

  if (!user) return null;

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

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : step > s
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > s ? <Check className="h-3.5 w-3.5" /> : s}
                </div>
                {s < 3 && <div className={`w-8 h-0.5 ${step > s ? "bg-primary/40" : "bg-muted"}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: Download app */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center">
                <Smartphone className="h-10 w-10 text-primary mx-auto mb-2" />
                <h2 className="font-semibold text-base mb-1">Stap 1: Download een authenticator app</h2>
                <p className="text-sm text-muted-foreground">
                  Een authenticator app genereert beveiligingscodes op je telefoon. Kies een van onderstaande apps en installeer deze.
                </p>
              </div>

              <div className="space-y-2">
                {AUTHENTICATOR_APPS.map((app) => (
                  <div key={app.name} className="border rounded-lg p-3">
                    <p className="font-medium text-sm mb-1.5">{app.name}</p>
                    <div className="flex gap-2">
                      <a
                        href={app.ios}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        iPhone <ExternalLink className="h-3 w-3" />
                      </a>
                      <a
                        href={app.android}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        Android <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Heb je al een authenticator app? Dan kun je direct door naar de volgende stap.
              </p>

              <Button onClick={goToStep2} className="w-full gap-2">
                Ik heb een app <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Scan QR code */}
          {step === 2 && (
            <div className="space-y-4">
              {enrolling ? (
                <p className="text-center text-sm text-muted-foreground py-8">Even laden...</p>
              ) : (
                <>
                  <div className="text-center">
                    <h2 className="font-semibold text-base mb-1">Stap 2: Koppel de app</h2>
                    <p className="text-sm text-muted-foreground">
                      Open je authenticator app en scan onderstaande QR-code. De app voegt automatisch je account toe.
                    </p>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    {qrUri && (
                      <img src={qrUri} alt="QR Code" className="w-44 h-44 rounded-lg border p-1 bg-white" />
                    )}
                  </div>

                  {/* Manual fallback */}
                  {secret && (
                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1.5">
                        Lukt het scannen niet? Voer deze code handmatig in:
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <code className="text-xs font-mono bg-background px-2 py-1 rounded border select-all break-all">
                          {secret}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                          title="Kopieer code"
                        >
                          {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button onClick={() => setStep(3)} className="w-full gap-2">
                    Ik heb de code gescand <ArrowRight className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Step 3: Verify */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-2" />
                <h2 className="font-semibold text-base mb-1">Stap 3: Bevestig de koppeling</h2>
                <p className="text-sm text-muted-foreground">
                  Vul de 6-cijferige code in die nu in je authenticator app staat.
                </p>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
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

              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors block w-full text-center"
              >
                ← Terug naar QR-code
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
