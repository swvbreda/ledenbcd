import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMembersData } from "@/contexts/MembersDataContext";

interface Props {
  type: "member" | "lead";
}

export default function NewMemberDialog({ type }: Props) {
  const navigate = useNavigate();
  const { rawMembers, rawLeads, rawOldMembers, refetch } = useMembersData();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [naam, setNaam] = useState("");
  const [bedrijfsnaam, setBedrijfsnaam] = useState("");
  const [plaats, setPlaats] = useState("");
  const [contactNaam, setContactNaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [lidSinds, setLidSinds] = useState<string>(String(new Date().getFullYear()));
  const [autoFill, setAutoFill] = useState(true);
  const [sendWelcome, setSendWelcome] = useState(true);

  const reset = () => {
    setNaam(""); setBedrijfsnaam(""); setPlaats("");
    setContactNaam(""); setEmail(""); setTelefoon("");
    setLidSinds(String(new Date().getFullYear()));
    setAutoFill(true);
    setSendWelcome(true);
  };

  const handleSave = async () => {
    if (!naam.trim()) { toast.error("Naam is verplicht"); return; }
    setSaving(true);
    try {
      const allIds = [...rawMembers, ...rawLeads, ...rawOldMembers].map((m) => m.id);
      const nextId = allIds.length ? Math.max(...allIds) + 1 : 1;

      const data = {
        id: nextId,
        naam: naam.trim(),
        bedrijfsnaam: bedrijfsnaam.trim() || naam.trim(),
        plaats: plaats.trim(),
        stadsdeel: "",
        contactpersoon: contactNaam.trim(),
        functie: "",
        telefoon: telefoon.trim(),
        email: email.trim(),
        oprichtingJaar: null,
        jarenLid: null,
        lidSinds: type === "member" && lidSinds ? Number(lidSinds) : null,
        aantalLocaties: autoFill ? 1 : 0,
        locaties: autoFill
          ? [{ naam: naam.trim(), plaats: plaats.trim(), adres: "", postcode: "" }]
          : [],
        ...(autoFill
          ? {
              factuurBedrijfsnaam: bedrijfsnaam.trim() || naam.trim(),
              factuurPlaats: plaats.trim(),
              factuurEmail: email.trim(),
              factuurTelefoon: telefoon.trim(),
            }
          : {}),
        contacten: contactNaam.trim() || email.trim() || telefoon.trim()
          ? [{ naam: contactNaam.trim(), functie: "", email: email.trim(), telefoon: telefoon.trim() }]
          : [],
      };

      const { error } = await supabase
        .from("members_data")
        .insert({ id: nextId, member_type: type, data });
      if (error) throw error;

      // Registreer e-mail in member_allowed_emails zodat het lid/lead een account kan aanmaken.
      // Zonder deze regel weigert de signup-functie de registratie ("e-mailadres niet geregistreerd").
      if (email.trim()) {
        const { error: allowErr } = await supabase
          .from("member_allowed_emails")
          .insert({ member_id: nextId, email: email.trim().toLowerCase() });
        if (allowErr && !String(allowErr.message || "").toLowerCase().includes("duplicate")) {
          console.error("Allowed email insert failed", allowErr);
        }
      }

      toast.success(type === "member" ? "Nieuw lid toegevoegd" : "Nieuwe lead toegevoegd");

      if (sendWelcome && email.trim()) {
        const tplKey = type === "member" ? "member_welcome" : "lead_welcome";
        const { data: tpl } = await supabase
          .from("email_templates")
          .select("subject, body")
          .eq("key", tplKey)
          .maybeSingle();
        if (tpl) {
          const fill = (s: string) =>
            s
              .split("{{contactpersoon}}").join(contactNaam.trim() || "lid")
              .split("{{coffeeshop}}").join(naam.trim())
              .split("{{plaats}}").join(plaats.trim());
          const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "member-welcome",
              recipientEmail: email.trim(),
              idempotencyKey: `welcome-${type}-${nextId}`,
              templateData: { subject: fill(tpl.subject), body: fill(tpl.body) },
            },
          });
          if (mailErr) toast.error("Welkomstmail mislukt: " + mailErr.message);
          else toast.success("Welkomstmail verstuurd");
        }
      }

      refetch();
      setOpen(false);
      reset();
      navigate(`/leden/${nextId}`);
    } catch (err) {
      toast.error("Toevoegen mislukt: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus size={14} /> {type === "member" ? "Nieuw lid" : "Nieuwe lead"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{type === "member" ? "Nieuw lid toevoegen" : "Nieuwe lead toevoegen"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Naam coffeeshop *</Label>
            <Input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="The Bulldog" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bedrijfsnaam</Label>
              <Input value={bedrijfsnaam} onChange={(e) => setBedrijfsnaam(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Plaats</Label>
              <Input value={plaats} onChange={(e) => setPlaats(e.target.value)} />
            </div>
          </div>
          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Eerste contactpersoon</p>
            <div>
              <Label className="text-xs">Naam</Label>
              <Input value={contactNaam} onChange={(e) => setContactNaam(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Telefoon</Label>
                <Input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} />
              </div>
            </div>
          </div>
          {type === "member" && (
            <div>
              <Label className="text-xs">Lid sinds (jaar)</Label>
              <Input type="number" value={lidSinds} onChange={(e) => setLidSinds(e.target.value)} />
            </div>
          )}
          <div className="flex items-start justify-between gap-3 border-t pt-3">
            <div className="space-y-0.5">
              <Label className="text-xs">Factuur- en locatiegegevens automatisch overnemen</Label>
              <p className="text-[11px] text-muted-foreground">
                Vult factuurgegevens en eerste locatie met de basisgegevens. Uitschakelen om later handmatig in te vullen.
              </p>
            </div>
            <Switch checked={autoFill} onCheckedChange={setAutoFill} />
          </div>
          <div className="flex items-start gap-2 border-t pt-3">
            <Checkbox
              id="send-welcome"
              checked={sendWelcome}
              onCheckedChange={(v) => setSendWelcome(!!v)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="send-welcome" className="text-xs cursor-pointer">
                Welkomstmail versturen
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Stuurt automatisch de {type === "member" ? "welkomstmail" : "uitnodigingsmail"} naar het opgegeven e-mailadres.
                Templates beheer je via E-mailtemplates.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Annuleren</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Opslaan..." : "Toevoegen"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}