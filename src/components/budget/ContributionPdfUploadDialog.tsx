import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

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

interface AiSuggestion {
  invoice_number?: string;
  member_name?: string;
  member_number?: number;
  matched_member_id?: number;
  confidence?: "high" | "medium" | "low";
}

export default function ContributionPdfUploadDialog({ open, onOpenChange, members, year, onUploaded }: Props) {
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [aiApplied, setAiApplied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    [members]
  );

  const resetState = () => {
    setSelectedMemberId("");
    setInvoiceNumber("");
    setUploading(false);
    setAnalyzing(false);
    setSelectedFile(null);
    setAiSuggestion(null);
    setAiApplied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  };

  const analyzeWithAi = async (file: File) => {
    setAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Send member list for matching
      const memberList = members.map(m => ({ id: m.id, naam: m.naam }));
      formData.append("members", JSON.stringify(memberList));

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-contribution-invoice`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Onbekend" }));
        console.warn("AI extraction failed:", err);
        toast.info("AI-herkenning mislukt, vul handmatig in");
        return;
      }

      const suggestion: AiSuggestion = await res.json();
      setAiSuggestion(suggestion);

      // Auto-apply suggestions
      if (suggestion.invoice_number) {
        setInvoiceNumber(suggestion.invoice_number);
      }
      if (suggestion.matched_member_id) {
        setSelectedMemberId(String(suggestion.matched_member_id));
      } else if (suggestion.member_number) {
        // Try matching by member number directly
        const match = members.find(m => m.id === suggestion.member_number);
        if (match) setSelectedMemberId(String(match.id));
      }
      setAiApplied(true);
      toast.success("Factuurnummer en lid automatisch herkend");
    } catch (e) {
      console.warn("AI analysis error:", e);
      toast.info("AI-herkenning niet beschikbaar, vul handmatig in");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    setSelectedFile(file);
    setAiSuggestion(null);
    setAiApplied(false);

    // Start AI analysis in parallel
    analyzeWithAi(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const memberId = Number(selectedMemberId);
    if (!memberId) {
      toast.error("Selecteer eerst een lid");
      return;
    }

    setUploading(true);
    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const safeInvoiceNumber = invoiceNumber.trim().replace(/[^a-zA-Z0-9-_]/g, "-");
      const path = `${year}/${memberId}/${crypto.randomUUID()}${safeInvoiceNumber ? `-${safeInvoiceNumber}` : ""}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("contribution-invoices")
        .upload(path, selectedFile, { upsert: true });

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
    }
  };

  const confidenceColor = (c?: string) => {
    if (c === "high") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    if (c === "medium") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
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
            Upload een contributie-PDF — factuurnummer en lid worden automatisch herkend via AI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: File selection */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center space-y-3">
            {analyzing ? (
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="h-10 w-10 animate-pulse text-primary" />
                <p className="text-sm text-muted-foreground">PDF wordt geanalyseerd door AI...</p>
              </div>
            ) : selectedFile ? (
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium truncate max-w-[300px]">{selectedFile.name}</span>
                </div>
                <label className="inline-block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading || analyzing}
                  />
                  <span className="text-xs text-primary cursor-pointer hover:underline">Ander bestand</span>
                </label>
              </div>
            ) : (
              <>
                <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Kies een PDF-factuur</p>
                  <p className="text-xs text-muted-foreground mt-1">Factuurnummer en lid worden automatisch herkend</p>
                </div>
                <label className="inline-block">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={uploading || analyzing}
                  />
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                    <Upload className="h-4 w-4" /> PDF kiezen
                  </span>
                </label>
              </>
            )}
          </div>

          {/* AI suggestion banner */}
          {aiApplied && aiSuggestion && (
            <div className="flex items-start gap-2 rounded-md bg-muted/50 border px-3 py-2 text-xs">
              <Sparkles className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
              <div className="space-y-0.5">
                <span className="font-medium">AI-suggestie:</span>
                {aiSuggestion.member_name && (
                  <span className="block">Lid: {aiSuggestion.member_name}</span>
                )}
                {aiSuggestion.invoice_number && (
                  <span className="block">Factuurnr: {aiSuggestion.invoice_number}</span>
                )}
                {aiSuggestion.confidence && (
                  <Badge variant="outline" className={`text-[10px] mt-1 ${confidenceColor(aiSuggestion.confidence)}`}>
                    {aiSuggestion.confidence === "high" ? "Zeker" : aiSuggestion.confidence === "medium" ? "Waarschijnlijk" : "Onzeker"}
                  </Badge>
                )}
              </div>
              {aiSuggestion.matched_member_id ? (
                <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0 ml-auto" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-yellow-600 shrink-0 ml-auto" />
              )}
            </div>
          )}

          {/* Step 2: Confirm/edit fields (shown after file selected) */}
          {selectedFile && !analyzing && (
            <>
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
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={uploading}>
            Sluiten
          </Button>
          {selectedFile && !analyzing && (
            <Button onClick={handleUpload} disabled={uploading || !selectedMemberId}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Uploaden...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-1.5" />
                  Uploaden
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
