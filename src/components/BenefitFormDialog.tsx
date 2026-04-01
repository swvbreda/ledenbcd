import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Benefit } from "@/hooks/useBenefits";
import { useBenefitMutations } from "@/hooks/useBenefits";
import { Trash2 } from "lucide-react";

const CATEGORIES = [
  "Beveiliging", "Facilitair", "Financieel", "Juridisch",
  "Marketing", "Personeel", "Technologie", "Verzekeringen", "Overig",
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  benefit?: Benefit | null;
}

export default function BenefitFormDialog({ open, onOpenChange, benefit }: Props) {
  const { upsert, remove } = useBenefitMutations();
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Overig",
    provider_name: "",
    provider_url: "",
    discount_info: "",
    contact_email: "",
    detail_content: "",
    featured: false,
    active: true,
    sort_order: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (benefit) {
      setForm({
        title: benefit.title,
        description: benefit.description || "",
        category: benefit.category,
        provider_name: benefit.provider_name || "",
        provider_url: benefit.provider_url || "",
        discount_info: benefit.discount_info || "",
        contact_email: benefit.contact_email || "",
        detail_content: benefit.detail_content || "",
        featured: benefit.featured,
        active: benefit.active,
        sort_order: benefit.sort_order,
      });
    } else {
      setForm({ title: "", description: "", category: "Overig", provider_name: "", provider_url: "", discount_info: "", contact_email: "", detail_content: "", featured: false, active: true, sort_order: 0 });
    }
    setImageFile(null);
  }, [benefit, open]);

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error("Titel is verplicht"); return; }
    setSaving(true);
    try {
      let image_path = benefit?.image_path || null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("benefit-images").upload(path, imageFile);
        if (uploadErr) throw uploadErr;
        image_path = path;
      }
      await upsert.mutateAsync({ ...form, image_path, id: benefit?.id } as any);
      toast.success(benefit ? "Voordeel bijgewerkt" : "Voordeel toegevoegd");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!benefit?.id || !confirm("Weet je zeker dat je dit voordeel wilt verwijderen?")) return;
    setSaving(true);
    try {
      await remove.mutateAsync(benefit.id);
      toast.success("Voordeel verwijderd");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{benefit ? "Voordeel bewerken" : "Nieuw voordeel"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label>Titel *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <Label>Categorie</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Beschrijving</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Aanbieder</Label>
            <Input value={form.provider_name} onChange={(e) => set("provider_name", e.target.value)} />
          </div>
          <div>
            <Label>Website aanbieder</Label>
            <Input value={form.provider_url} onChange={(e) => set("provider_url", e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label>Ledenvoordeel / korting</Label>
            <Input value={form.discount_info} onChange={(e) => set("discount_info", e.target.value)} placeholder="bijv. 10% korting voor BCD-leden" />
          </div>
          <div>
            <Label>Contact e-mail</Label>
            <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </div>
          <div>
            <Label>Afbeelding</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch checked={form.featured} onCheckedChange={(v) => set("featured", v)} />
              <Label>Uitgelicht</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
              <Label>Actief</Label>
            </div>
          </div>
          <div>
            <Label>Sorteervolgorde</Label>
            <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
            {benefit && (
              <Button variant="destructive" onClick={handleDelete} disabled={saving} size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
