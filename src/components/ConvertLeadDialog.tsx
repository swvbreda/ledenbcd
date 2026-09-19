import { useEffect, useState } from "react";
import { nextMemberNumber } from "@/lib/memberNumber";
import { UserPlus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const queryClient = useQueryClient();
  const { rawMembers, rawLeads, rawOldMembers } = useMembersData();
  const maxExistingId = [...rawMembers, ...rawLeads, ...rawOldMembers].reduce(
    (max, m) => Math.max(max, m.id),
    0,
  );
  const suggestedLidnummer = getNextLidnummer(maxExistingId, conversions);

  const [open, setOpen] = useState(false);
  const [lidnummer, setLidnummer] = useState(suggestedLidnummer);

  // Bij openen het laagste vrije lidnummer voorstellen (gaten worden opgevuld).
  useEffect(() => {
    if (!open) return;
    let actief = true;
    nextMemberNumber()
      .then((nummer) => {
        if (actief) setLidnummer(nummer);
      })
      .catch(() => {
        /* valt terug op het voorstel op basis van het hoogste nummer */
      });
    return () => {
      actief = false;
    };
  }, [open]);
  const [lidSinds, setLidSinds] = useState(new Date().getFullYear());
  const [factuurBedrijfsnaam, setFactuurBedrijfsnaam] = useState(lead.factuurBedrijfsnaam || lead.bedrijfsnaam || "");
  const [factuurKvk, setFactuurKvk] = useState(lead.factuurKvk || lead.kvk || "");
  const [factuurEmail, setFactuurEmail] = useState(lead.factuurEmail || lead.email || "");
  const [saving, setSaving] = useState(false);

  // Bij een vastgelegde contributievrijstelling blijft het dossiernummer staan,
  // zodat de vrijstelling gekoppeld blijft en er geen factuur kan ontstaan.
  const { data: exemptions } = useQuery({
    queryKey: ["contribution-exemptions", "lead", lead.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contribution_exemptions")
        .select("year, reason")
        .eq("member_id", lead.id);
      if (error) throw error;
      return (data ?? []) as Array<{ year: number; reason: string }>;
    },
  });
  const vrijstelling = (exemptions ?? [])[0];
  const nummerVast = !!vrijstelling;
  const gebruiktNummer = nummerVast ? lead.id : lidnummer;

  const handleConvert = async () => {
    setSaving(true);
    try {
      const resultaat = await convertLead({
        leadId: lead.id,
        lidnummer: gebruiktNummer,
        lidSinds,
        factuurBedrijfsnaam: factuurBedrijfsnaam || undefined,
        factuurKvk: factuurKvk || undefined,
        factuurEmail: factuurEmail || undefined,
        leadEmail: lead.email,
      });
      toast.success(`${lead.naam} is omgezet naar lid #${resultaat.lidnummer}`);
      queryClient.invalidateQueries({ queryKey: ["members-data"] });
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
          {vrijstelling && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-medium">{vrijstelling.reason}</p>
              <p className="text-xs mt-1">
                Het dossiernummer {lead.id} blijft ongewijzigd zodat de vrijstelling behouden blijft en
                er geen factuur wordt aangemaakt.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="lidnummer">Lidnummer</Label>
              <Input
                id="lidnummer"
                type="number"
                value={gebruiktNummer}
                disabled={nummerVast}
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
