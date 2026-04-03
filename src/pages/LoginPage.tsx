import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Lock, LogIn, UserPlus } from "lucide-react";
import bcdLogo from "@/assets/bcd-logo.png";

const LoginPage = () => {
  const { user, loading: authLoading, isExtern } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMode, setResetMode] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }

  if (user) {
    if (isExtern) return <Navigate to="/extern" replace />;
    // MFA check handled by ProtectedRoute — just go to home
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message === "Invalid login credentials"
        ? "Ongeldig e-mailadres of wachtwoord"
        : error.message);
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens zijn");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/member-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ email: email.trim(), password }),
        }
      );

      const data = await response.json();

      if (!response.ok || data?.error) {
        setError(data?.error || "Registratie mislukt. Probeer het opnieuw.");
        setLoading(false);
        return;
      }

      setRegisterSuccess(true);
    } catch {
      setError("Er is een fout opgetreden");
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(error.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const switchMode = (mode: "login" | "register" | "reset") => {
    setError("");
    setResetMode(mode === "reset");
    setRegisterMode(mode === "register");
    setResetSent(false);
    setRegisterSuccess(false);
  };

  const getSubtitle = () => {
    if (resetMode) return "Voer je e-mailadres in om je wachtwoord te herstellen";
    if (registerMode) return "Gebruik het e-mailadres waarop je de updates van de bond ontvangt en kies zelf een wachtwoord";
    return "Log in om verder te gaan";
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-lg border border-border p-8 shadow-sm">
          <div className="text-center mb-6">
            <img src={bcdLogo} alt="Bond van Cannabis Detaillisten" className="h-12 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-bold font-display">Ledenportaal</h1>
            <p className="text-sm text-muted-foreground mt-1">{getSubtitle()}</p>
          </div>

          {resetSent ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Als er een account bestaat met dit e-mailadres, ontvang je een e-mail met een link om je wachtwoord te herstellen.
              </p>
              <button onClick={() => switchMode("login")} className="text-sm text-primary hover:underline">
                Terug naar inloggen
              </button>
            </div>
          ) : registerSuccess ? (
            <div className="text-center space-y-3">
              <div className="p-3 bg-success/10 rounded-md">
                <p className="text-sm text-success font-medium">Account succesvol aangemaakt!</p>
                <p className="text-xs text-muted-foreground mt-1">Je kunt nu inloggen met je e-mailadres en wachtwoord.</p>
              </div>
              <button
                onClick={() => { switchMode("login"); }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <LogIn size={16} /> Inloggen
              </button>
            </div>
          ) : (
            <form
              onSubmit={resetMode ? handleResetPassword : registerMode ? handleRegister : handleLogin}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="naam@voorbeeld.nl"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {!resetMode && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">{registerMode ? "Kies een wachtwoord" : "Wachtwoord"}</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={registerMode ? "Kies minimaal 8 tekens" : "••••••••"}
                      required
                      minLength={8}
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              {registerMode && (
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
                      minLength={8}
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {registerMode ? <UserPlus size={16} /> : <LogIn size={16} />}
                {loading
                  ? "Bezig..."
                  : resetMode
                  ? "Verstuur herstel-e-mail"
                  : registerMode
                  ? "Registreren"
                  : "Inloggen"}
              </button>

              <div className="text-center space-y-1">
                {!resetMode && (
                  <button
                    type="button"
                    onClick={() => switchMode(registerMode ? "login" : "register")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                  >
                    {registerMode ? "Heb je al een account? Inloggen" : "Nog geen account? Registreren"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => switchMode(resetMode ? "login" : "reset")}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                >
                  {resetMode ? "Terug naar inloggen" : "Wachtwoord vergeten?"}
                </button>
                <a
                  href="/extern-login"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                >
                  Inloggen als externe partij →
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
