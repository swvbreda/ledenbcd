import { useState, useEffect } from "react";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { KeyRound, Bell, User, Shield, Pencil, Clock, Save, X, UserCog, ShieldCheck, ShieldAlert, Fingerprint, ScanFace, Trash2 } from "lucide-react";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { usePasskeys } from "@/hooks/usePasskeys";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { useMembersData } from "@/contexts/MembersDataContext";
import MailingPreferences from "@/components/MailingPreferences";
import MemberEditForm from "@/components/MemberEditForm";
import ExternToestemmingBeheer from "@/components/ExternToestemmingBeheer";
import { ContributiePaymentCard } from "@/components/ContributiePaymentCard";
import type { Member } from "@/data/types";
import { Capacitor } from "@capacitor/core";
import MediaUpload from "@/components/members/MediaUpload";
import { useContactPhotos, contactSlug } from "@/hooks/useMemberMedia";

// ── Password Section ──
function PasswordSection() {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPw.length < 8) { toast.error("Wachtwoord moet minimaal 8 tekens zijn"); return; }
    if (newPw !== confirmPw) { toast.error("Wachtwoorden komen niet overeen"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) { toast.error("Fout bij wijzigen: " + error.message); }
    else { toast.success("Wachtwoord succesvol gewijzigd"); setNewPw(""); setConfirmPw(""); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Wachtwoord wijzigen</h3>
      </div>
      <div className="space-y-3 max-w-sm">
        <Input type="password" placeholder="Nieuw wachtwoord" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <Input type="password" placeholder="Bevestig wachtwoord" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        <Button onClick={handleChangePassword} disabled={saving} size="sm">
          {saving ? "Opslaan..." : "Wachtwoord opslaan"}
        </Button>
      </div>
    </Card>
  );
}

// ── MFA Section ──
function MfaSection() {
  const [hasTotp, setHasTotp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      setHasTotp((data?.totp?.filter(f => f.status === "verified")?.length ?? 0) > 0);
      setLoading(false);
    });
  }, []);

  const handleUnenroll = async () => {
    if (!confirm("Weet je zeker dat je dubbele verificatie wilt uitschakelen? Je moet het daarna opnieuw instellen.")) return;
    setResetting(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const factors = data?.totp?.filter(f => f.status === "verified") ?? [];
    for (const factor of factors) {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
    toast.success("Dubbele verificatie uitgeschakeld. Je wordt doorgestuurd om het opnieuw in te stellen.");
    setResetting(false);
    window.location.href = "/mfa-setup";
  };

  if (loading) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        {hasTotp ? <ShieldCheck size={16} className="text-brand-red" /> : <ShieldAlert size={16} className="text-destructive" />}
        <h3 className="text-sm font-semibold font-display">Dubbele verificatie (2FA)</h3>
      </div>
      <div className="space-y-3 max-w-sm">
        {hasTotp ? (
          <>
            <p className="text-sm text-muted-foreground">
              Dubbele verificatie is actief via je authenticator app.
            </p>
            <Button variant="outline" size="sm" onClick={handleUnenroll} disabled={resetting}>
              {resetting ? "Bezig..." : "Opnieuw instellen"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Dubbele verificatie is niet ingesteld. Dit is verplicht.
            </p>
            <Button size="sm" onClick={() => window.location.href = "/mfa-setup"}>
              Nu instellen
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

// ── Notification Section ──
function NotificationSection() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  useState(() => {
    if (!user) { setLoading(false); return; }
    supabase.from("push_device_tokens").select("id").eq("user_id", user.id)
      .then(({ data }) => { setPushEnabled((data?.length ?? 0) > 0); setLoading(false); });
  });

  const handleToggle = async () => {
    if (!isNative) { toast.info("Push-notificaties zijn alleen beschikbaar in de mobiele app"); return; }
    if (pushEnabled) {
      const { error } = await supabase.from("push_device_tokens").delete().eq("user_id", user!.id);
      if (error) { toast.error("Fout bij uitschakelen: " + error.message); return; }
      setPushEnabled(false); toast.success("Push-notificaties uitgeschakeld");
    } else {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") { toast.error("Geen toestemming voor notificaties"); return; }
        await PushNotifications.register(); setPushEnabled(true); toast.success("Push-notificaties ingeschakeld");
      } catch { toast.error("Kon notificaties niet inschakelen"); }
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Notificatie-instellingen</h3>
      </div>
      <div className="flex items-center justify-between max-w-sm">
        <Label htmlFor="push-toggle" className="text-sm">Push-notificaties</Label>
        {loading ? <span className="text-xs text-muted-foreground">Laden...</span> : (
          <Switch id="push-toggle" checked={pushEnabled} onCheckedChange={handleToggle} />
        )}
      </div>
      {!isNative && <p className="text-xs text-muted-foreground mt-2">Push-notificaties zijn alleen beschikbaar in de mobiele app.</p>}
    </Card>
  );
}

// ── Biometric Section ──
function BiometricSection() {
  const biometric = useBiometricAuth();

  if (!biometric.isNative || !biometric.isAvailable) return null;

  const handleToggle = async () => {
    if (biometric.hasCredentials) {
      await biometric.deleteCredentials();
      toast.success(`${biometric.biometryLabel} uitgeschakeld`);
    } else {
      toast.info("Log opnieuw in om biometrische login te activeren");
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Fingerprint size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Biometrische login</h3>
      </div>
      <div className="flex items-center justify-between max-w-sm">
        <Label htmlFor="bio-toggle" className="text-sm">Inloggen met {biometric.biometryLabel}</Label>
        <Switch id="bio-toggle" checked={biometric.hasCredentials} onCheckedChange={handleToggle} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {biometric.hasCredentials
          ? `${biometric.biometryLabel} is actief. Je kunt snel inloggen met biometrie.`
          : "Activeer bij je volgende login op het inlogscherm."}
      </p>
    </Card>
  );
}


// ── Passkey Section (Web biometric) ──
function PasskeySection() {
  const passkeys = usePasskeys();
  const [registeredKeys, setRegisteredKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  useEffect(() => {
    supabase.from("passkey_credentials").select("id, device_name, created_at")
      .then(({ data }) => { setRegisteredKeys(data || []); setLoadingKeys(false); });
  }, []);

  const handleRegister = async () => {
    const deviceName = navigator.userAgent.includes("iPhone") || navigator.userAgent.includes("iPad")
      ? "iPhone/iPad"
      : navigator.userAgent.includes("Android")
      ? "Android"
      : navigator.userAgent.includes("Mac")
      ? "Mac"
      : navigator.userAgent.includes("Windows")
      ? "Windows"
      : "Apparaat";

    const result = await passkeys.registerPasskey(deviceName);
    if (result.success) {
      toast.success("Passkey geregistreerd! Log uit en log opnieuw in om Face ID / vingerafdruk te testen.", { duration: 8000 });
      // Refresh list
      const { data } = await supabase.from("passkey_credentials").select("id, device_name, created_at");
      setRegisteredKeys(data || []);
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("passkey_credentials").delete().eq("id", id);
    if (error) { toast.error("Kon passkey niet verwijderen"); return; }
    setRegisteredKeys((prev) => prev.filter((k) => k.id !== id));
    toast.success("Passkey verwijderd");
  };

  if (!passkeys.available) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <ScanFace size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Inloggen met Face ID / vingerafdruk</h3>
      </div>
      <div className="space-y-3 max-w-sm">
        <p className="text-xs text-muted-foreground">
          Registreer dit apparaat om snel in te loggen met gezichtsherkenning of vingerafdruk.
        </p>

        {/* Registered passkeys */}
        {!loadingKeys && registeredKeys.length > 0 && (
          <div className="space-y-2">
            {registeredKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                <div>
                  <p className="text-sm font-medium">{key.device_name || "Apparaat"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(key.created_at).toLocaleDateString("nl-NL")}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(key.id)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleRegister}
          disabled={passkeys.loading}
          size="sm"
          variant={registeredKeys.length > 0 ? "outline" : "default"}
        >
          <ScanFace size={14} className="mr-1.5" />
          {passkeys.loading ? "Bezig..." : registeredKeys.length > 0 ? "Nog een apparaat toevoegen" : "Activeer voor dit apparaat"}
        </Button>
      </div>
    </Card>
  );
}


interface BoardMemberData {
  id: string;
  naam: string;
  functie: string;
  email: string | null;
  bond_email: string | null;
  telefoon: string | null;
  prive_adres: string | null;
  prive_postcode: string | null;
  prive_plaats: string | null;
  geboortedatum: string | null;
  coffeeshop: string | null;
  coffeeshop_plaats: string | null;
}

const EditableField = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <div>
    <label className="text-xs text-muted-foreground block mb-0.5">{label}</label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-8 text-sm" />
  </div>
);

// ── Board Member Edit Section ──
function BoardMemberSection({ boardMember, onSaved }: { boardMember: BoardMemberData; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [naam, setNaam] = useState(boardMember.naam);
  const [email, setEmail] = useState(boardMember.email || "");
  const [telefoon, setTelefoon] = useState(boardMember.telefoon || "");
  const [priveAdres, setPriveAdres] = useState(boardMember.prive_adres || "");
  const [privePostcode, setPrivePostcode] = useState(boardMember.prive_postcode || "");
  const [privePlaats, setPrivePlaats] = useState(boardMember.prive_plaats || "");
  const [geboortedatum, setGeboortedatum] = useState(boardMember.geboortedatum || "");

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("board_members").update({
      naam,
      email: email || null,
      telefoon: telefoon || null,
      prive_adres: priveAdres || null,
      prive_postcode: privePostcode || null,
      prive_plaats: privePlaats || null,
      geboortedatum: geboortedatum || null,
    }).eq("id", boardMember.id);
    setSaving(false);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
    } else {
      toast.success("Bestuursgegevens opgeslagen");
      setEditing(false);
      onSaved();
    }
  };

  if (!editing) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCog size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold font-display">Bestuursgegevens</h3>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
            <Pencil size={14} /> Bewerken
          </Button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-28 shrink-0">Naam:</span>
            <span className="font-medium">{boardMember.naam}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-28 shrink-0">Functie:</span>
            <span className="font-medium">{boardMember.functie}</span>
          </div>
          {boardMember.bond_email && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Bond e-mail:</span>
              <span className="font-medium break-all">{boardMember.bond_email}</span>
            </div>
          )}
          {boardMember.email && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Privé e-mail:</span>
              <span className="font-medium break-all">{boardMember.email}</span>
            </div>
          )}
          {boardMember.telefoon && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Telefoon:</span>
              <span className="font-medium">{boardMember.telefoon}</span>
            </div>
          )}
          {boardMember.coffeeshop && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Coffeeshop:</span>
              <span className="font-medium">{boardMember.coffeeshop}{boardMember.coffeeshop_plaats ? ` (${boardMember.coffeeshop_plaats})` : ""}</span>
            </div>
          )}
          {boardMember.prive_adres && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Privé-adres:</span>
              <span className="font-medium">{boardMember.prive_adres}, {boardMember.prive_postcode} {boardMember.prive_plaats}</span>
            </div>
          )}
          {boardMember.geboortedatum && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground w-28 shrink-0">Geboortedatum:</span>
              <span className="font-medium">{boardMember.geboortedatum}</span>
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCog size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold font-display">Bestuursgegevens bewerken</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
            <X size={14} /> Annuleren
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save size={14} /> {saving ? "Opslaan..." : "Opslaan"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EditableField label="Naam" value={naam} onChange={setNaam} />
        <div>
          <label className="text-xs text-muted-foreground block mb-0.5">Functie</label>
          <Input value={boardMember.functie} disabled className="h-8 text-sm bg-muted" />
        </div>
        <EditableField label="Privé e-mail" value={email} onChange={setEmail} />
        <EditableField label="Telefoon" value={telefoon} onChange={setTelefoon} />
        <EditableField label="Privé-adres" value={priveAdres} onChange={setPriveAdres} />
        <EditableField label="Postcode" value={privePostcode} onChange={setPrivePostcode} />
        <EditableField label="Plaats" value={privePlaats} onChange={setPrivePlaats} />
        <EditableField label="Geboortedatum" value={geboortedatum} onChange={setGeboortedatum} type="date" />
      </div>
    </Card>
  );
}

// ── Profile Card ──
function ProfileCard({ linkedMember }: { linkedMember?: Member }) {
  const { user, isAdmin } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTelefoon, setEditTelefoon] = useState("");
  const [editEmail2, setEditEmail2] = useState("");
  const [saving, setSaving] = useState(false);
  const { photos, uploadPhoto, removePhoto } = useContactPhotos(linkedMember?.id);
  const photoName = linkedMember?.contactpersoon || "";


  useEffect(() => {
    if (linkedMember) {
      setEditName(linkedMember.contactpersoon || "");
      setEditTelefoon(linkedMember.telefoon || "");
      setEditEmail2(linkedMember.email || "");
    }
  }, [linkedMember]);

  const handleSaveProfile = async () => {
    if (!linkedMember || !user) return;
    setSaving(true);
    
    const editData: Record<string, unknown> = {};
    if (editName !== (linkedMember.contactpersoon || "")) editData.contactpersoon = editName;
    if (editTelefoon !== (linkedMember.telefoon || "")) editData.telefoon = editTelefoon;
    if (editEmail2 !== (linkedMember.email || "")) editData.email = editEmail2;

    if (Object.keys(editData).length === 0) {
      setSaving(false);
      setEditingProfile(false);
      return;
    }

    if (isAdmin) {
      // Admin: save directly
      const { data: existing } = await supabase
        .from("member_edits")
        .select("data")
        .eq("member_id", linkedMember.id)
        .maybeSingle();
      const existingData = (existing?.data as Record<string, unknown>) || {};
      const mergedData = { ...existingData, ...editData };

      const { error } = await supabase
        .from("member_edits")
        .upsert(
          { member_id: linkedMember.id, data: mergedData as any, updated_by: user.id, updated_at: new Date().toISOString() },
          { onConflict: "member_id" }
        );
      setSaving(false);
      if (error) { toast.error("Opslaan mislukt: " + error.message); return; }
      toast.success("Gegevens opgeslagen");
    } else {
      // Member: submit edit request
      const { error } = await supabase
        .from("member_edit_requests")
        .insert({ member_id: linkedMember.id, data: editData as any, submitted_by: user.id });
      setSaving(false);
      if (error) { toast.error("Opslaan mislukt: " + error.message); return; }
      toast.success("Wijziging ingediend ter goedkeuring");
    }
    setEditingProfile(false);
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <User size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold font-display">Profiel</h3>
        </div>
        {linkedMember && !editingProfile && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingProfile(true)}>
            <Pencil size={14} /> Bewerken
          </Button>
        )}
      </div>

      {linkedMember && photoName && (
        <div className="flex items-center gap-3 mb-4">
          <MediaUpload
            url={photos[contactSlug(photoName)] ?? null}
            naam={photoName}
            size={56}
            canEdit
            onUpload={(file) => uploadPhoto(photoName, file)}
            onRemove={() => removePhoto(photoName)}
          />
          <div className="text-xs text-muted-foreground">
            <div className="font-medium text-foreground text-sm">{photoName}</div>
            Klik op de foto om een profielfoto toe te voegen of te wijzigen.
          </div>
        </div>
      )}


      {editingProfile && linkedMember ? (
        <div className="space-y-3 max-w-sm">
          <div>
            <label className="text-xs text-muted-foreground block mb-0.5">Naam contactpersoon</label>
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-0.5">E-mail (lid)</label>
            <Input value={editEmail2} onChange={(e) => setEditEmail2(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-0.5">Telefoon</label>
            <Input value={editTelefoon} onChange={(e) => setEditTelefoon(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-0.5">Account e-mail</label>
            <Input value={user?.email || ""} disabled className="h-8 text-sm bg-muted" />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveProfile} disabled={saving} className="gap-1.5">
              <Save size={14} /> {saving ? "Opslaan..." : "Opslaan"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingProfile(false)} className="gap-1.5">
              <X size={14} /> Annuleren
            </Button>
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock size={12} /> Wijzigingen worden beoordeeld door het bestuur.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground w-28 shrink-0">Account e-mail:</span>
            <span className="font-medium break-all">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-28 shrink-0">Rol:</span>
            <span className="font-medium flex items-center gap-1.5">
              {isAdmin && <Shield size={12} className="text-brand-red" />}
              {isAdmin ? "Beheerder" : "Lid"}
            </span>
          </div>
          {linkedMember && (
            <>
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Gekoppeld lid:</span>
                <span className="font-medium">{linkedMember.bedrijfsnaam || linkedMember.naam}</span>
              </div>
              {linkedMember.contactpersoon && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Contactpersoon:</span>
                  <span className="font-medium">{linkedMember.contactpersoon}</span>
                </div>
              )}
              {linkedMember.email && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">E-mail (lid):</span>
                  <span className="font-medium break-all">{linkedMember.email}</span>
                </div>
              )}
              {linkedMember.telefoon && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Telefoon:</span>
                  <span className="font-medium">{linkedMember.telefoon}</span>
                </div>
              )}
              {linkedMember.plaats && (
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground w-28 shrink-0">Plaats:</span>
                  <span className="font-medium">{linkedMember.plaats}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Main Page ──
export default function MijnAccountPage() {
  const { user, isAdmin, linkedMemberId } = useAuth();
  const { allMembersAndLeads } = useMembersData();
  const { members: allMembers } = useMergedMembers(allMembersAndLeads);
  const [editingMember, setEditingMember] = useState(false);
  const [boardMember, setBoardMember] = useState<BoardMemberData | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);

  const linkedMember: Member | undefined = linkedMemberId
    ? allMembers.find((m) => m.id === linkedMemberId)
    : undefined;

  // Fetch board member data for current user by matching email
  const fetchBoardMember = async () => {
    if (!user?.email) { setBoardLoading(false); return; }
    const { data } = await supabase
      .from("board_members")
      .select("id, naam, functie, email, bond_email, telefoon, prive_adres, prive_postcode, prive_plaats, geboortedatum, coffeeshop, coffeeshop_plaats")
      .or(`bond_email.eq.${user.email},email.eq.${user.email}`);
    setBoardMember(data?.[0] ?? null);
    setBoardLoading(false);
  };

  useEffect(() => {
    fetchBoardMember();
  }, [user?.email]);

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden max-w-full">
      <BcdHeroBanner title="Mijn Account" subtitle="Beheer je accountinstellingen">
        {linkedMember && !editingMember && (
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setEditingMember(true)}>
            <Pencil size={14} /> Lidgegevens bewerken
          </Button>
        )}
      </BcdHeroBanner>

      {/* Member edit form */}
      {linkedMember && editingMember && (
        <>
          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 bg-muted border border-border rounded-lg">
              <Clock size={14} className="text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">Wijzigingen worden beoordeeld door het bestuur.</p>
            </div>
          )}
          <MemberEditForm member={linkedMember} editing={editingMember} setEditing={setEditingMember} />
        </>
      )}

      {/* Profile & settings - hide when editing member */}
      {!editingMember && (
        <>
          <ProfileCard linkedMember={linkedMember} />

          {/* Contributie betalen */}
          {linkedMember && <ContributiePaymentCard />}

          {/* Board member section */}
          {!boardLoading && boardMember && (
            <BoardMemberSection boardMember={boardMember} onSaved={fetchBoardMember} />
          )}

          {/* Mailing preferences */}
          {linkedMember && <MailingPreferences member={linkedMember} canEdit={true} />}

          {/* Extern data sharing consent */}
          {linkedMember && (
            <Card className="p-5">
              <ExternToestemmingBeheer />
            </Card>
          )}

          <MfaSection />
          <BiometricSection />
          <PasskeySection />
          <NotificationSection />
          <PasswordSection />
        </>
      )}
    </div>
  );
}
