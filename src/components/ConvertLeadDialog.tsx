import { useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { convertLead, getNextLidnummer, type LeadConversion } from "@/hooks/useLeadConversions";
import type { Member } from "@/data/types";
import { useMembersData } from "@/contexts/MembersDataContext";
import { toast } from "sonner";

interface Props {
  lead: Member;
  conversions: LeadConversion[];
  onConverted?: () => void;
}

const ConvertLeadDialog = ({ lead, conversions, onConverted }: Props) => {
  const { rawMembers } = useMembersData();
  const maxExistingId = rawMembers.reduce((max, m) => Math.max(max, m.id), 0);
  const suggestedLidnummer = getNextLidnummer(maxExistingId, conversions);

  const [open, setOpen] = useState(false);
  const [lidnummer, setLidnummer] = useState(suggestedLidnummer);
  const [lidSinds, setLidSinds] = useState(new Date().getFullYear());
  const [factuurBedrijfsnaam, setFactuurBedrijfsnaam] = useState(lead.factuurBedrijfsnaam || lead.bedrijfsnaam || "");
  const [factuurKvk, setFactuurKvk] = useState(lead.factuurKvk || lead.kvk || "");
  const [factuurEmail, setFactuurEmail] = useState(lead.factuurEmail || lead.email || "");
  const [saving, setSaving] = useState(false);

  const handleConvert = async () => {
    setSaving(true);
    try {
      await convertLead({
        leadId: lead.id,
        lidnummer,
        lidSinds,
        factuurBedrijfsnaam: factuurBedrijfsnaam || undefined,
        factuurKvk: factuurKvk || undefined,
        factuurEmail: factuurEmail || undefined,
        leadEmail: lead.email,
      });
      toast.success(`${lead.naam} is omgezet naar lid #${lidnummer}`);
      setOpen(false);
      onConverted?.();
    } catch (err: any) {
      toast.error(err.message || "Omzetten mislukt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <UserPlus size={14} /> Omzetten naar lid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lead omzetten naar lid</DialogTitle>
          <DialogDescription>
            {lead.naam} wordt een volwaardig lid van de bond.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lidnummer">Lidnummer</Label>
              <Input
                id="lidnummer"
                type="number"
                value={lidnummer}
                onChange={(e) => setLidnummer(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lidSinds">Lid sinds (jaar)</Label>
              <Input
                id="lidSinds"
                type="number"
                value={lidSinds}
                onChange={(e) => setLidSinds(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-medium text-muted-foreground mb-3">Factuurgegevens</p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="factuurBedrijfsnaam">Bedrijfsnaam</Label>
                <Input
                  id="factuurBedrijfsnaam"
                  value={factuurBedrijfsnaam}
                  onChange={(e) => setFactuurBedrijfsnaam(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="factuurKvk">KVK-nummer</Label>
                  <Input
                    id="factuurKvk"
                    value={factuurKvk}
                    onChange={(e) => setFactuurKvk(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="factuurEmail">Factuur e-mail</Label>
                  <Input
                    id="factuurEmail"
                    type="email"
                    value={factuurEmail}
                    onChange={(e) => setFactuurEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button onClick={handleConvert} disabled={saving || !lidnummer}>
            {saving ? "Bezig..." : "Omzetten naar lid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConvertLeadDialog;
