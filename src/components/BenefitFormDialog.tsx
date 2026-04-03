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
import { useBenefitMutations, getBenefitImageUrl } from "@/hooks/useBenefits";
import { useBenefitImages, useBenefitImageMutations } from "@/hooks/useBenefitImages";
import { Trash2, Plus, ImagePlus, X } from "lucide-react";

const CATEGORIES = [
  "Beveiliging", "Facilitair", "Financieel", "Juridisch",
  "Marketing", "Personeel", "Technologie", "Verzekeringen", "Overig",
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  benefit?: Benefit | null;
  supplierOrgId?: string;
}

export default function BenefitFormDialog({ open, onOpenChange, benefit, supplierOrgId }: Props) {
  const { upsert, remove } = useBenefitMutations();
  const { data: existingImages = [] } = useBenefitImages(benefit?.id);
  const { addImage, removeImage } = useBenefitImageMutations(benefit?.id);
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
    price: "" as string,
    original_price: "" as string,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
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
        price: benefit.price != null ? String(benefit.price) : "",
        original_price: benefit.original_price != null ? String(benefit.original_price) : "",
      });
    } else {
      setForm({ title: "", description: "", category: "Overig", provider_name: "", provider_url: "", discount_info: "", contact_email: "", detail_content: "", featured: false, active: true, sort_order: 0, price: "", original_price: "" });
    }
    setImageFile(null);
    setGalleryFiles([]);
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
      const payload = { ...form, image_path, id: benefit?.id, price: form.price ? Number(form.price) : null, original_price: form.original_price ? Number(form.original_price) : null, ...(supplierOrgId ? { supplier_org_id: supplierOrgId } : {}) } as any;
      await upsert.mutateAsync(payload);
      // Upload gallery images if any
      if (galleryFiles.length > 0 && benefit?.id) {
        const startOrder = existingImages.length;
        for (let i = 0; i < galleryFiles.length; i++) {
          await addImage.mutateAsync({ file: galleryFiles[i], sort_order: startOrder + i });
        }
      }
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ledenprijs (€)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="bijv. 474.09" />
            </div>
            <div>
              <Label>Reguliere prijs (€)</Label>
              <Input type="number" step="0.01" value={form.original_price} onChange={(e) => set("original_price", e.target.value)} placeholder="bijv. 557.75" />
            </div>
          </div>
          <div>
            <Label>Contact e-mail</Label>
            <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} />
          </div>
          <div>
            <Label>Afbeelding</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
          </div>
          {/* Gallery images */}
          {benefit?.id && (
            <div>
              <Label>Extra afbeeldingen (galerij)</Label>
              {existingImages.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {existingImages.map((img) => {
                    const url = getBenefitImageUrl(img.image_path);
                    return (
                      <div key={img.id} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                        {url && <img src={url} alt="" className="w-full h-full object-cover" />}
                        <button
                          type="button"
                          onClick={async () => {
                            await removeImage.mutateAsync({ id: img.id, image_path: img.image_path });
                            toast.success("Afbeelding verwijderd");
                          }}
                          className="absolute inset-0 bg-destructive/70 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))}
              />
              {galleryFiles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{galleryFiles.length} bestand(en) geselecteerd</p>
              )}
            </div>
          )}
          <div>
            <Label>Detailpagina inhoud (Markdown)</Label>
            <Textarea
              value={form.detail_content}
              onChange={(e) => set("detail_content", e.target.value)}
              rows={8}
              placeholder={"## Producten\n\n### Product 1\nBeschrijving...\n\n**Prijs:** €100"}
            />
            <p className="text-xs text-muted-foreground mt-1">Gebruik Markdown voor opmaak: ## kopjes, **vet**, - opsommingen, etc.</p>
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
