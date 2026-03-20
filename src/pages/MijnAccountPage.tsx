import { useState, useEffect } from "react";
import { KeyRound, Bell, User, Shield, Pencil, Clock, Save, X, UserCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { allMembersAndLeads } from "@/hooks/useMembers";
import MailingPreferences from "@/components/MailingPreferences";
import MemberEditForm from "@/components/MemberEditForm";
import type { Member } from "@/data/types";
import { Capacitor } from "@capacitor/core";

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

// ── Board Member types ──
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
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <User size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Profiel</h3>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-28 shrink-0">E-mail:</span>
          <span className="font-medium break-all">{user?.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-28 shrink-0">Rol:</span>
          <span className="font-medium flex items-center gap-1.5">
            {isAdmin && <Shield size={12} className="text-primary" />}
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
    </Card>
  );
}

// ── Main Page ──
export default function MijnAccountPage() {
  const { user, isAdmin, linkedMemberId } = useAuth();
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Mijn Account</h2>
          <p className="text-sm text-muted-foreground mt-1">Beheer je accountinstellingen</p>
        </div>
        {linkedMember && !editingMember && (
          <Button variant="outline" size="sm" className="self-start shrink-0 gap-1.5" onClick={() => setEditingMember(true)}>
            <Pencil size={14} /> Lidgegevens bewerken
          </Button>
        )}
      </div>

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

          {/* Board member section */}
          {!boardLoading && boardMember && (
            <BoardMemberSection boardMember={boardMember} onSaved={fetchBoardMember} />
          )}

          {/* Mailing preferences */}
          {linkedMember && <MailingPreferences member={linkedMember} canEdit={true} />}

          <NotificationSection />
          <PasswordSection />
        </>
      )}
    </div>
  );
}
