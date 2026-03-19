import { useState, useEffect } from "react";
import { Shield, Plus, Pencil, Trash2, GripVertical, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface BoardMember {
  id: string;
  naam: string;
  functie: string;
  type: "bestuurslid" | "aspirant";
  lid_id: number | null;
  email: string | null;
  bond_email: string | null;
  telefoon: string | null;
  prive_adres: string | null;
  prive_postcode: string | null;
  prive_plaats: string | null;
  geboortedatum: string | null;
  coffeeshop: string | null;
  coffeeshop_plaats: string | null;
  sort_order: number;
}

const emptyMember: Omit<BoardMember, "id"> = {
  naam: "",
  functie: "",
  type: "bestuurslid",
  lid_id: null,
  email: null,
  bond_email: null,
  telefoon: null,
  prive_adres: null,
  prive_postcode: null,
  prive_plaats: null,
  geboortedatum: null,
  coffeeshop: null,
  coffeeshop_plaats: null,
  sort_order: 0,
};

export default function BestuurBeheerPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<BoardMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingMember, setEditingMember] = useState<Partial<BoardMember> & Omit<typeof emptyMember, "sort_order"> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }
    fetchMembers();
  }, [isAdmin]);

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from("board_members")
      .select("*")
      .order("sort_order");
    if (error) {
      toast.error("Fout bij laden: " + error.message);
    } else {
      setMembers((data as BoardMember[]) || []);
    }
    setLoading(false);
  };

  const openNew = () => {
    const maxOrder = members.length > 0 ? Math.max(...members.map((m) => m.sort_order)) : 0;
    setEditingMember({ ...emptyMember, sort_order: maxOrder + 1 });
    setDialogOpen(true);
  };

  const openEdit = (member: BoardMember) => {
    setEditingMember({ ...member });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingMember) return;
    if (!editingMember.naam?.trim() || !editingMember.functie?.trim()) {
      toast.error("Naam en functie zijn verplicht");
      return;
    }
    setSaving(true);

    const payload = {
      naam: editingMember.naam.trim(),
      functie: editingMember.functie.trim(),
      type: editingMember.type,
      lid_id: editingMember.lid_id || null,
      email: editingMember.email?.trim() || null,
      bond_email: editingMember.bond_email?.trim() || null,
      telefoon: editingMember.telefoon?.trim() || null,
      prive_adres: editingMember.prive_adres?.trim() || null,
      prive_postcode: editingMember.prive_postcode?.trim() || null,
      prive_plaats: editingMember.prive_plaats?.trim() || null,
      geboortedatum: editingMember.geboortedatum?.trim() || null,
      coffeeshop: editingMember.coffeeshop?.trim() || null,
      coffeeshop_plaats: editingMember.coffeeshop_plaats?.trim() || null,
      sort_order: editingMember.sort_order,
    };

    if ("id" in editingMember && editingMember.id) {
      const { error } = await supabase
        .from("board_members")
        .update(payload)
        .eq("id", editingMember.id);
      if (error) {
        toast.error("Fout bij opslaan: " + error.message);
      } else {
        toast.success("Bestuurslid bijgewerkt");
      }
    } else {
      const { error } = await supabase.from("board_members").insert(payload);
      if (error) {
        toast.error("Fout bij toevoegen: " + error.message);
      } else {
        toast.success("Bestuurslid toegevoegd");
      }
    }

    setSaving(false);
    setDialogOpen(false);
    setEditingMember(null);
    fetchMembers();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("board_members").delete().eq("id", deleteId);
    if (error) {
      toast.error("Fout bij verwijderen: " + error.message);
    } else {
      toast.success("Bestuurslid verwijderd");
    }
    setDeleteId(null);
    fetchMembers();
  };

  const updateField = (field: string, value: string | number | null) => {
    if (!editingMember) return;
    setEditingMember({ ...editingMember, [field]: value });
  };

  const bestuursleden = members.filter((m) => m.type === "bestuurslid");
  const aspiranten = members.filter((m) => m.type === "aspirant");

  const renderRow = (member: BoardMember) => (
    <div
      key={member.id}
      className="flex items-center gap-3 py-2.5 px-3 rounded-md border border-border hover:bg-muted/30 transition-colors"
    >
      <GripVertical size={14} className="text-muted-foreground/40 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{member.naam}</p>
        <p className="text-xs text-primary">{member.functie}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
          {member.bond_email && (
            <span className="text-[11px] text-muted-foreground">{member.bond_email}</span>
          )}
          {member.telefoon && (
            <span className="text-[11px] text-muted-foreground">{member.telefoon}</span>
          )}
          {member.coffeeshop && (
            <span className="text-[11px] text-muted-foreground">{member.coffeeshop}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(member)}>
          <Pencil size={13} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(member.id)}>
          <Trash2 size={13} />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold font-display flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          Bestuur beheren
        </h1>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus size={14} /> Toevoegen
        </Button>
      </div>

      {bestuursleden.length > 0 && (
        <div className="mb-4">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Bestuursleden</h2>
          <div className="space-y-1.5">
            {bestuursleden.map(renderRow)}
          </div>
        </div>
      )}

      {aspiranten.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Aspiranten</h2>
          <div className="space-y-1.5">
            {aspiranten.map(renderRow)}
          </div>
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-muted-foreground">Nog geen bestuursleden toegevoegd.</p>
      )}

      {/* Edit/Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditingMember(null); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMember && "id" in editingMember ? "Bestuurslid bewerken" : "Bestuurslid toevoegen"}
            </DialogTitle>
          </DialogHeader>
          {editingMember && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Naam *</Label>
                  <Input value={editingMember.naam || ""} onChange={(e) => updateField("naam", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Functie *</Label>
                  <Input value={editingMember.functie || ""} onChange={(e) => updateField("functie", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={editingMember.type} onValueChange={(v) => updateField("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bestuurslid">Bestuurslid</SelectItem>
                      <SelectItem value="aspirant">Aspirant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Lid ID (nummer)</Label>
                  <Input
                    type="number"
                    value={editingMember.lid_id ?? ""}
                    onChange={(e) => updateField("lid_id", e.target.value ? parseInt(e.target.value) : null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Bond e-mail</Label>
                  <Input value={editingMember.bond_email || ""} onChange={(e) => updateField("bond_email", e.target.value)} placeholder="naam@coffeeshopbond.nl" />
                </div>
                <div>
                  <Label className="text-xs">Persoonlijk e-mail</Label>
                  <Input value={editingMember.email || ""} onChange={(e) => updateField("email", e.target.value)} />
                </div>
              </div>

              <div>
                <Label className="text-xs">Telefoon</Label>
                <Input value={editingMember.telefoon || ""} onChange={(e) => updateField("telefoon", e.target.value)} />
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Privégegevens</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Adres</Label>
                    <Input value={editingMember.prive_adres || ""} onChange={(e) => updateField("prive_adres", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Postcode</Label>
                    <Input value={editingMember.prive_postcode || ""} onChange={(e) => updateField("prive_postcode", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label className="text-xs">Plaats</Label>
                    <Input value={editingMember.prive_plaats || ""} onChange={(e) => updateField("prive_plaats", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Geboortedatum</Label>
                    <Input value={editingMember.geboortedatum || ""} onChange={(e) => updateField("geboortedatum", e.target.value)} placeholder="dd-mm-jjjj" />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Coffeeshop</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Coffeeshop</Label>
                    <Input value={editingMember.coffeeshop || ""} onChange={(e) => updateField("coffeeshop", e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Coffeeshop plaats</Label>
                    <Input value={editingMember.coffeeshop_plaats || ""} onChange={(e) => updateField("coffeeshop_plaats", e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-3 mt-3">
                <div>
                  <Label className="text-xs">Sorteervolgorde</Label>
                  <Input
                    type="number"
                    value={editingMember.sort_order ?? 0}
                    onChange={(e) => updateField("sort_order", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingMember(null); }}>
                  Annuleren
                </Button>
                <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                  <Save size={14} />
                  {saving ? "Opslaan..." : "Opslaan"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bestuurslid verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dit bestuurslid wordt definitief verwijderd uit het overzicht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
