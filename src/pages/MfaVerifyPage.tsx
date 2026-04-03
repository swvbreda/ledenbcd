import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";

export default function MfaVerifyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState("");

  useEffect(() => {
    // Get the user's TOTP factor
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const totp = data?.totp?.[0];
      if (totp) {
        setFactorId(totp.id);
      } else {
        // No factor enrolled, redirect to setup
        navigate("/mfa-setup", { replace: true });
      }
    });
  }, [navigate]);

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
      toast.error("Ongeldige code. Probeer het opnieuw.");
      setCode("");
      setLoading(false);
      return;
    }
    // MFA verified, redirect to home
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
      <div className="w-full max-w-sm">
        <Card className="p-8">
          <div className="text-center mb-6">
            <img src={bcdLogo} alt="BCD" className="h-12 w-auto mx-auto mb-4" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold font-display">Verificatie vereist</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Voer de code uit je authenticator app in om door te gaan
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
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
            </div>
            <Button type="submit" disabled={loading || code.length !== 6} className="w-full gap-2">
              <LogIn className="h-4 w-4" />
              {loading ? "Verifiëren..." : "Doorgaan"}
            </Button>
          </form>

          <div className="text-center mt-4">
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
