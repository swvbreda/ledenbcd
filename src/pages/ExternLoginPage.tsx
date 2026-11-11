import { useState } from "react";
import { Navigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Mail, Lock, LogIn, Building2, UserPlus, User, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callerSupabase } from "@/lib/callerClient";
import bcdLogo from "@/assets/bcd-logo.png";
import { Capacitor } from "@capacitor/core";

const ExternLoginPage = () => {
  const isNative = Capacitor.isNativePlatform();
  const { user, isExtern, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try { return localStorage.getItem("remember_me") !== "false"; } catch { return true; }
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("bank");
  const [contactName, setContactName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [registerSuccess, setRegisterSuccess] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try { localStorage.setItem("remember_me", String(isNative || rememberMe)); } catch {}
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
      const settings = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}});
      if(!settings.ok || (await settings.json()).mailer_autoconfirm !== false) throw new Error("Registratie wacht op veilige e-mailbevestigingsinstellingen. Neem contact op met het secretariaat.");
      const { data, error: signupError } = await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:`${window.location.origin}/extern-login`}});
      if(signupError) throw signupError;
      if(data.session) throw new Error("Automatische bevestiging is niet toegestaan.");
      setRegisterSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er is een fout opgetreden");
    }
    setLoading(false);
  };

  const submitOrganization = async () => {
    setLoading(true); setError("");
    try {
      const client=await callerSupabase();
      const {error}=await client.rpc("submit_verified_external_signup",{p_name:orgName,p_type:orgType,p_contact:contactName});
      if(error) throw error;
      window.location.assign("/extern");
    } catch {setError("Bevestig eerst uw e-mailadres. Uw aanvraag kon niet worden ingediend.");}
    finally {setLoading(false);}
  };
  if (user && !isExtern) return <div className="min-h-screen bg-background flex items-center justify-center p-4"><div className="max-w-sm space-y-4"><h1 className="font-display text-xl">Organisatieaanvraag</h1><p>Bevestig uw e-mailadres. Het bestuur beoordeelt uw aanvraag voordat toegang wordt verleend.</p><input aria-label="Organisatienaam" value={orgName} onChange={e=>setOrgName(e.target.value)} className="border border-input rounded-md p-2 w-full"/><input aria-label="Contactnaam" value={contactName} onChange={e=>setContactName(e.target.value)} className="border border-input rounded-md p-2 w-full"/><select aria-label="Organisatietype" value={orgType} onChange={e=>setOrgType(e.target.value)}><option value="bank">Bank</option><option value="overheid">Overheid</option><option value="leverancier">Leverancier</option><option value="anders">Anders</option></select>{error&&<p className="text-destructive">{error}</p>}<Button onClick={()=>void submitOrganization()} disabled={loading||!orgName.trim()||!contactName.trim()}>Aanvraag indienen</Button></div></div>;
  if (user) return <Navigate to="/extern" replace />;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-4 z-50">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-lg border border-border p-8 shadow-xs">
          <div className="text-center mb-6">
            <img src={bcdLogo} alt="Bond van Cannabis Detaillisten" className="h-12 w-auto mx-auto mb-4" />
            <h1 className="text-2xl font-bold font-display">Extern Portaal</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "register"
                ? "Registreer uw organisatie voor toegang tot het ledenbestand"
                : "Inloggen als externe partij"}
            </p>
          </div>

          {registerSuccess ? (
            <div className="text-center space-y-3">
              <div className="p-3 bg-success/10 rounded-md">
                <p className="text-sm text-success font-medium">Registratie ontvangen!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Bevestig eerst uw e-mailadres via de ontvangen link. Log daarna in en dien uw organisatieaanvraag in; toegang volgt pas na expliciete goedkeuring.
                </p>
              </div>
              <button
                onClick={() => { setMode("login"); setRegisterSuccess(false); setError(""); }}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <LogIn size={16} /> Inloggen
              </button>
            </div>
          ) : (
            <form onSubmit={mode === "register" ? handleRegister : handleLogin} className="space-y-4">
              {mode === "register" && (
                <>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Organisatienaam</label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="Naam van uw organisatie"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Type organisatie</label>
                    <select
                      value={orgType}
                      onChange={(e) => setOrgType(e.target.value)}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-hidden focus:ring-2 focus:ring-ring"
                    >
                      <option value="bank">Bank</option>
                      <option value="overheid">Overheid</option>
                      <option value="leverancier">Leverancier / Aanbieder</option>
                      <option value="anders">Anders</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-1 block">Uw naam</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Uw volledige naam"
                        required
                        className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">E-mail</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="naam@organisatie.nl"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1 block">
                  {mode === "register" ? "Kies een wachtwoord" : "Wachtwoord"}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === "register" ? "Minimaal 8 tekens" : "••••••••"}
                    required
                    minLength={8}
                    className="w-full pl-9 pr-10 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">Bevestig wachtwoord</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="w-full pl-9 pr-10 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "login" && !isNative && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => {
                      setRememberMe(e.target.checked);
                      try { localStorage.setItem("remember_me", String(e.target.checked)); } catch {}
                    }}
                    className="rounded-sm border-input h-4 w-4 text-primary focus:ring-ring"
                  />
                  <span className="text-sm text-muted-foreground">Onthoud mij</span>
                </label>
              )}

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-md py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {mode === "register" ? <UserPlus size={16} /> : <LogIn size={16} />}
                {loading ? "Bezig..." : mode === "register" ? "Registreren" : "Inloggen"}
              </button>

              <div className="text-center space-y-1">
                <button
                  type="button"
                  onClick={() => { setMode(mode === "register" ? "login" : "register"); setError(""); }}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block w-full"
                >
                  {mode === "register" ? "Al een account? Inloggen" : "Nog geen account? Registreren"}
                </button>
                <a
                  href="/login"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors block"
                >
                  Inloggen als lid →
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExternLoginPage;
