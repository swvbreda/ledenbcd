import { useState } from "react";
import { KeyRound, Bell, Mail, User, Shield, Pencil, Clock } from "lucide-react";
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

function PasswordSection() {
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      toast.error("Wachtwoord moet minimaal 8 tekens zijn");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Wachtwoorden komen niet overeen");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) {
      toast.error("Fout bij wijzigen: " + error.message);
    } else {
      toast.success("Wachtwoord succesvol gewijzigd");
      setNewPw("");
      setConfirmPw("");
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Wachtwoord wijzigen</h3>
      </div>
      <div className="space-y-3 max-w-sm">
        <Input
          type="password"
          placeholder="Nieuw wachtwoord"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Bevestig wachtwoord"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
        />
        <Button onClick={handleChangePassword} disabled={saving} size="sm">
          {saving ? "Opslaan..." : "Wachtwoord opslaan"}
        </Button>
      </div>
    </Card>
  );
}

function NotificationSection() {
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isNative = Capacitor.isNativePlatform();

  useState(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("push_device_tokens")
      .select("id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        setPushEnabled((data?.length ?? 0) > 0);
        setLoading(false);
      });
  });

  const handleToggle = async () => {
    if (!isNative) {
      toast.info("Push-notificaties zijn alleen beschikbaar in de mobiele app");
      return;
    }

    if (pushEnabled) {
      const { error } = await supabase
        .from("push_device_tokens")
        .delete()
        .eq("user_id", user!.id);
      if (error) {
        toast.error("Fout bij uitschakelen: " + error.message);
        return;
      }
      setPushEnabled(false);
      toast.success("Push-notificaties uitgeschakeld");
    } else {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") {
          toast.error("Geen toestemming voor notificaties");
          return;
        }
        await PushNotifications.register();
        setPushEnabled(true);
        toast.success("Push-notificaties ingeschakeld");
      } catch {
        toast.error("Kon notificaties niet inschakelen");
      }
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={16} className="text-muted-foreground" />
        <h3 className="text-sm font-semibold font-display">Notificatie-instellingen</h3>
      </div>
      <div className="flex items-center justify-between max-w-sm">
        <Label htmlFor="push-toggle" className="text-sm">
          Push-notificaties
        </Label>
        {loading ? (
          <span className="text-xs text-muted-foreground">Laden...</span>
        ) : (
          <Switch
            id="push-toggle"
            checked={pushEnabled}
            onCheckedChange={handleToggle}
          />
        )}
      </div>
      {!isNative && (
        <p className="text-xs text-muted-foreground mt-2">
          Push-notificaties zijn alleen beschikbaar in de mobiele app.
        </p>
      )}
    </Card>
  );
}

/** Profile card with member details when linked */
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
            {linkedMember.website && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground w-28 shrink-0">Website:</span>
                <a href={linkedMember.website.startsWith("http") ? linkedMember.website : `https://${linkedMember.website}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline break-all">
                  {linkedMember.website}
                </a>
              </div>
            )}
          </>
        )}
        {!linkedMember && (
          <div className="mt-3 p-3 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground">
              Je account is niet gekoppeld aan een lidprofiel. Neem contact op met het bestuur om je account te koppelen.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function MijnAccountPage() {
  const { user, isAdmin, linkedMemberId } = useAuth();
  const { members: allMembers } = useMergedMembers(allMembersAndLeads);
  const [editing, setEditing] = useState(false);

  const linkedMember: Member | undefined = linkedMemberId
    ? allMembers.find((m) => m.id === linkedMemberId)
    : undefined;

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Mijn Account</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Beheer je accountinstellingen
          </p>
        </div>
        {linkedMember && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="self-start shrink-0 gap-1.5"
            onClick={() => setEditing(true)}
          >
            <Pencil size={14} /> Gegevens bewerken
          </Button>
        )}
      </div>

      {/* Edit form for linked member */}
      {linkedMember && editing && (
        <>
          {!isAdmin && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Clock size={14} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                Wijzigingen worden beoordeeld door het bestuur voordat ze worden doorgevoerd.
              </p>
            </div>
          )}
          <MemberEditForm member={linkedMember} editing={editing} setEditing={setEditing} />
        </>
      )}

      {/* Profile & settings - hide when editing */}
      {!editing && (
        <>
          <ProfileCard linkedMember={linkedMember} />

          {/* Mailing preferences - only for linked members */}
          {linkedMember && (
            <MailingPreferences member={linkedMember} canEdit={true} />
          )}

          {/* Notification settings */}
          <NotificationSection />

          {/* Password */}
          <PasswordSection />
        </>
      )}
    </div>
  );
}
