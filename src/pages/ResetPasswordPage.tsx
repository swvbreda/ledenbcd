import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      setIsRecovery(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      return;
    }
    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens bevatten");
      return;
    }

    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm bg-card rounded-lg border border-border p-8 shadow-sm text-center">
          <p className="text-muted-foreground">Ongeldige of verlopen link.</p>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Terug naar inloggen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold font-display">Nieuw wachtwoord</h1>
            <p className="text-sm text-muted-foreground mt-1">Voer je nieuwe wachtwoord in</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle className="text-green-600" size={32} />
              <p className="text-sm text-muted-foreground">Wachtwoord gewijzigd! Je wordt doorgestuurd...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Nieuw wachtwoord</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">Bevestig wachtwoord</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Bezig..." : "Wachtwoord opslaan"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
