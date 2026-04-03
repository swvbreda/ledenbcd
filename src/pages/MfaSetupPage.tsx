import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Shield, QrCode, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";

export default function MfaSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [qrUri, setQrUri] = useState("");
  const [factorId, setFactorId] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [enrolling, setEnrolling] = useState(true);

  useEffect(() => {
    if (!user) return;
    enrollFactor();
  }, [user]);

  const enrollFactor = async () => {
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Authenticator App",
    });
    if (error) {
      toast.error("Kon MFA niet instellen: " + error.message);
      setEnrolling(false);
      return;
    }
    setQrUri(data.totp.qr_code);
    setFactorId(data.id);
    setSecret(data.totp.secret);
    setEnrolling(false);
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
      toast.error("Ongeldige code. Probeer het opnieuw.");
      setCode("");
      setLoading(false);
      return;
    }
    toast.success("Dubbele verificatie succesvol ingesteld!");
    navigate("/");
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
      <div className="w-full max-w-md">
        <Card className="p-8">
          <div className="text-center mb-6">
            <img src={bcdLogo} alt="BCD" className="h-12 w-auto mx-auto mb-4" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold font-display">Dubbele verificatie instellen</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Scan de QR-code met een authenticator app zoals Google Authenticator of Authy
            </p>
          </div>

          {enrolling ? (
            <p className="text-center text-sm text-muted-foreground">QR-code laden...</p>
          ) : (
            <div className="space-y-6">
              {/* QR Code */}
              <div className="flex justify-center">
                {qrUri ? (
                  <img src={qrUri} alt="QR Code" className="w-48 h-48 rounded-lg border" />
                ) : (
                  <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center">
                    <QrCode className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Manual entry */}
              {secret && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Of voer deze code handmatig in:</p>
                  <code className="text-xs bg-muted px-3 py-1.5 rounded font-mono select-all break-all">
                    {secret}
                  </code>
                </div>
              )}

              {/* Verification form */}
              <form onSubmit={handleVerify} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Verificatiecode</label>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Voer de 6-cijferige code uit je authenticator app in
                  </p>
                </div>
                <Button type="submit" disabled={loading || code.length !== 6} className="w-full gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {loading ? "Verifiëren..." : "Verificatie voltooien"}
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
