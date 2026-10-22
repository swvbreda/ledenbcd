import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordResetForm({ onSave, onSuccess }: {
  onSave: (password: string) => Promise<{ data?: { error?: string } | null; error: { message: string } | null }>;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (password.length < 8) { setError("Gebruik minimaal 8 tekens."); return; }
    if (password !== confirmation) { setError("De wachtwoorden zijn niet hetzelfde."); return; }
    setSaving(true);
    setError("");
    try {
      const result = await onSave(password);
      if (result.error || result.data?.error) {
        setError("Niet opgeslagen. Probeer een unieke wachtwoordzin met meerdere woorden. Blijft het misgaan? Probeer het later opnieuw.");
        return;
      }
      onSuccess();
    } catch {
      setError("Niet opgeslagen. Controleer je verbinding en probeer opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="space-y-3 pt-2">
    <p className="text-sm text-muted-foreground">Gebruik een unieke wachtwoordzin met meerdere woorden (minimaal 8 tekens).</p>
    <Input type="password" aria-label="Nieuw wachtwoord" autoComplete="new-password" placeholder="Nieuw wachtwoord" value={password} disabled={saving} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
    <Input type="password" aria-label="Bevestig wachtwoord" autoComplete="new-password" placeholder="Bevestig wachtwoord" value={confirmation} disabled={saving} onChange={(event) => { setConfirmation(event.target.value); setError(""); }} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" className="w-full" disabled={saving}>{saving ? "Opslaan..." : "Wachtwoord opslaan"}</Button>
  </form>;
}