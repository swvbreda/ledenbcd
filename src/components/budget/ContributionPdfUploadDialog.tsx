import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MemberOption {
  id: number;
  naam: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberOption[];
  year: number;
  onUploaded: (payload: { member_id: number; invoice_file_path: string; invoice_number?: string | null }) => Promise<void>;
}

export default function ContributionPdfUploadDialog({ open, onOpenChange, members, year, onUploaded }: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    [members]
  );

  const resetState = () => {
    setSelectedMemberId("");
    setInvoiceNumber("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const memberId = Number(selectedMemberId);
    if (!memberId) {
      toast.error("Selecteer eerst een lid");
      e.target.value = "";
      return;
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Alleen PDF-bestanden zijn toegestaan");
      e.target.value = "";
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 20MB)");
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
      const safeInvoiceNumber = invoiceNumber.trim().replace(/[^a-zA-Z0-9-_]/g, "-");
      const path = `${year}/${memberId}/${crypto.randomUUID()}${safeInvoiceNumber ? `-${safeInvoiceNumber}` : ""}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contribution-invoices")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      await onUploaded({
        member_id: memberId,
        invoice_file_path: path,
        invoice_number: invoiceNumber.trim() || null,
      });

      toast.success("PDF-factuur geüpload");
      handleClose(false);
    } catch (error: any) {
      toast.error(`Upload mislukt: ${error.message || "onbekende fout"}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF-factuur uploaden ({year})
          </DialogTitle>
          <DialogDescription>
            Koppel een contributie-PDF direct aan een lid zodat de factuur meteen zichtbaar is in het overzicht.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Lid *</Label>
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer een lid" />
              </SelectTrigger>
              <SelectContent>
                {sortedMembers.map((member) => (
                  <SelectItem key={member.id} value={String(member.id)}>
                    #{member.id} {member.naam}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-number">Factuurnummer</Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Bijv. 2026012"
            />
          </div>

          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">PDF wordt geüpload...</p>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Kies een PDF-factuur</p>
                  <p className="text-xs text-muted-foreground mt-1">Maximaal 20MB, wordt direct aan het geselecteerde lid gekoppeld</p>
                </div>
                <label className="inline-block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                    <Upload className="h-4 w-4" /> PDF kiezen
                  </span>
                </label>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Sluiten
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
