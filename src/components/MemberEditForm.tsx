import { useState } from "react";
import { Pencil, Save, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { Member, Contact, Location } from "@/data/types";
import { useSaveMemberEdit } from "@/hooks/useMemberEdits";

const FUNCTIE_OPTIONS = ["Eigenaar", "Bestuurder", "Manager", "Bedrijfsleider", "Contactpersoon", "Bestuur"] as const;

interface Props {
  member: Member;
  editing: boolean;
  setEditing: (v: boolean) => void;
}

const EditableField = ({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) => (
  <div>
    <label className="text-xs text-muted-foreground block mb-0.5">{label}</label>
    <Input value={value} onChange={(e) => onChange(e.target.value)} type={type} className="h-8 text-sm" />
  </div>
);

export default function MemberEditForm({ member, editing, setEditing }: Props) {
  const saveMutation = useSaveMemberEdit();

  // Editable state
  const [naam, setNaam] = useState(member.naam);
  const [plaats, setPlaats] = useState(member.plaats);
  const [bedrijfsnaam, setBedrijfsnaam] = useState(member.bedrijfsnaam);
  const [kvk, setKvk] = useState(member.kvk || "");
  const [website, setWebsite] = useState(member.website || "");
  const [instagram, setInstagram] = useState(member.instagram || "");
  const [facebook, setFacebook] = useState(member.facebook || "");
  const [oprichtingJaar, setOprichtingJaar] = useState(String(member.oprichtingJaar || ""));
  const [lidSinds, setLidSinds] = useState(String(member.lidSinds || ""));

  // Factuur
  const [factuurBedrijfsnaam, setFactuurBedrijfsnaam] = useState(member.factuurBedrijfsnaam || "");
  const [factuurKvk, setFactuurKvk] = useState(member.factuurKvk || "");
  const [factuurAdres, setFactuurAdres] = useState(member.factuurAdres || "");
  const [factuurPostcode, setFactuurPostcode] = useState(member.factuurPostcode || "");
  const [factuurPlaats, setFactuurPlaats] = useState(member.factuurPlaats || "");
  const [factuurEmail, setFactuurEmail] = useState(member.factuurEmail || "");
  const [factuurTelefoon, setFactuurTelefoon] = useState(member.factuurTelefoon || "");

  // Contacten
  const [contacten, setContacten] = useState<Contact[]>([...member.contacten]);

  // Locaties
  const [locaties, setLocaties] = useState<Location[]>([...member.locaties]);

  const updateContact = (idx: number, field: keyof Contact, value: string) => {
    setContacten((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const addContact = () => {
    setContacten((prev) => [...prev, { naam: "", functie: "", telefoon: "", email: "" }]);
  };

  const removeContact = (idx: number) => {
    setContacten((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLocation = (idx: number, field: keyof Location, value: string) => {
    setLocaties((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLocation = () => {
    setLocaties((prev) => [...prev, { naam: "", plaats: "", adres: "", postcode: "" }]);
  };

  const removeLocation = (idx: number) => {
    setLocaties((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const data: Partial<Member> = {
      naam,
      plaats,
      bedrijfsnaam,
      kvk: kvk || undefined,
      website: website || undefined,
      instagram: instagram || undefined,
      facebook: facebook || undefined,
      oprichtingJaar: oprichtingJaar ? Number(oprichtingJaar) : null,
      lidSinds: lidSinds ? Number(lidSinds) : null,
      factuurBedrijfsnaam: factuurBedrijfsnaam || undefined,
      factuurKvk: factuurKvk || undefined,
      factuurAdres: factuurAdres || undefined,
      factuurPostcode: factuurPostcode || undefined,
      factuurPlaats: factuurPlaats || undefined,
      factuurEmail: factuurEmail || undefined,
      factuurTelefoon: factuurTelefoon || undefined,
      contacten,
      locaties,
      aantalLocaties: locaties.length,
    };

    saveMutation.mutate(
      { member_id: member.id, data },
      {
        onSuccess: () => {
          toast.success("Wijzigingen opgeslagen");
          setEditing(false);
        },
        onError: (err) => {
          toast.error("Opslaan mislukt: " + (err as Error).message);
        },
      }
    );
  };

  if (!editing) return null;

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
          <X size={14} /> Annuleren
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
          <Save size={14} /> {saveMutation.isPending ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>

      {/* Basisgegevens */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold font-display mb-2">Basisgegevens</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EditableField label="Naam" value={naam} onChange={setNaam} />
          <EditableField label="Plaats" value={plaats} onChange={setPlaats} />
          <EditableField label="KVK" value={kvk} onChange={setKvk} />
          <EditableField label="Oprichtingsjaar" value={oprichtingJaar} onChange={setOprichtingJaar} type="number" />
          <EditableField label="Lid sinds" value={lidSinds} onChange={setLidSinds} type="number" />
        </div>
      </div>

      {/* Online */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold font-display mb-2">Online</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <EditableField label="Website" value={website} onChange={setWebsite} />
          <EditableField label="Instagram" value={instagram} onChange={setInstagram} />
          <EditableField label="Facebook" value={facebook} onChange={setFacebook} />
        </div>
      </div>

      {/* Contactpersonen */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-display">Contactpersonen</h3>
          <Button variant="outline" size="sm" onClick={addContact} className="gap-1 text-xs h-7">
            <Plus size={12} /> Toevoegen
          </Button>
        </div>
        {contacten.map((c, i) => (
          <div key={i} className="border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Contact {i + 1}</span>
              <Button variant="ghost" size="sm" onClick={() => removeContact(i)} className="h-6 w-6 p-0 text-destructive">
                <Trash2 size={12} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditableField label="Naam" value={c.naam} onChange={(v) => updateContact(i, "naam", v)} />
              <EditableField label="Functie" value={c.functie} onChange={(v) => updateContact(i, "functie", v)} />
              <EditableField label="E-mail" value={c.email} onChange={(v) => updateContact(i, "email", v)} />
              <EditableField label="Telefoon" value={c.telefoon} onChange={(v) => updateContact(i, "telefoon", v)} />
            </div>
          </div>
        ))}
      </div>

      {/* Factuurgegevens */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <h3 className="text-sm font-semibold font-display mb-2">Factuurgegevens</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <EditableField label="Bedrijfsnaam" value={factuurBedrijfsnaam} onChange={setFactuurBedrijfsnaam} />
          <EditableField label="KVK" value={factuurKvk} onChange={setFactuurKvk} />
          <EditableField label="Adres" value={factuurAdres} onChange={setFactuurAdres} />
          <EditableField label="Postcode" value={factuurPostcode} onChange={setFactuurPostcode} />
          <EditableField label="Plaats" value={factuurPlaats} onChange={setFactuurPlaats} />
          <EditableField label="E-mail" value={factuurEmail} onChange={setFactuurEmail} />
          <EditableField label="Telefoon" value={factuurTelefoon} onChange={setFactuurTelefoon} />
        </div>
      </div>

      {/* Locaties */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold font-display">Locaties</h3>
          <Button variant="outline" size="sm" onClick={addLocation} className="gap-1 text-xs h-7">
            <Plus size={12} /> Toevoegen
          </Button>
        </div>
        {locaties.map((loc, i) => (
          <div key={i} className="border border-border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Locatie {i + 1}</span>
              <Button variant="ghost" size="sm" onClick={() => removeLocation(i)} className="h-6 w-6 p-0 text-destructive">
                <Trash2 size={12} />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <EditableField label="Naam" value={loc.naam} onChange={(v) => updateLocation(i, "naam", v)} />
              <EditableField label="Plaats" value={loc.plaats || ""} onChange={(v) => updateLocation(i, "plaats", v)} />
              <EditableField label="Adres" value={loc.adres || ""} onChange={(v) => updateLocation(i, "adres", v)} />
              <EditableField label="Postcode" value={loc.postcode || ""} onChange={(v) => updateLocation(i, "postcode", v)} />
              <EditableField label="Stadsdeel" value={loc.stadsdeel || ""} onChange={(v) => updateLocation(i, "stadsdeel", v)} />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom save */}
      <div className="flex items-center gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="gap-1.5">
          <X size={14} /> Annuleren
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5">
          <Save size={14} /> {saveMutation.isPending ? "Opslaan..." : "Opslaan"}
        </Button>
      </div>
    </div>
  );
}
