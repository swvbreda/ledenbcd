import { useState, useRef } from "react";
import { Upload, Loader2, CheckCircle2, AlertCircle, XCircle, FileUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Proposal {
  type: string;
  match_id: string | null;
  name: string;
  amount: number;
  date: string | null;
  invoice_number: string | null;
  confidence: "high" | "medium" | "low";
  description: string;
  applied: boolean;
}

interface Props {
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const confidenceColors: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

const confidenceLabels: Record<string, string> = {
  high: "Zeker",
  medium: "Waarschijnlijk",
  low: "Onzeker",
};

const typeLabels: Record<string, string> = {
  payment_received: "Betaling ontvangen",
  invoice_sent: "Factuur verstuurd",
  unknown: "Onbekend",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

export default function AdminUploadDialog({ year, open, onOpenChange, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [autoApplied, setAutoApplied] = useState(0);
  const [fileName, setFileName] = useState("");
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setProcessing(true);
    setProposals(null);
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", year.toString());

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-admin-upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Verwerking mislukt");

      setProposals(data.proposals);
      setAutoApplied(data.autoApplied);

      if (data.autoApplied > 0) {
        toast.success(`${data.autoApplied} betalingen automatisch verwerkt`);
      }
    } catch (e: any) {
      toast.error("Fout: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const applyProposal = async (proposal: Proposal, index: number) => {
    if (!proposal.contribution_id || proposal.applied) return;
    setApplyingId(proposal.contribution_id);

    try {
      if (proposal.type === "payment_received") {
        const { error } = await supabase
          .from("member_contributions")
          .update({
            paid: true,
            paid_date: proposal.date || new Date().toISOString().split("T")[0],
          })
          .eq("id", proposal.contribution_id)
          .eq("paid", false);
        if (error) throw error;

        // Complete related todo
        await supabase
          .from("finance_todos")
          .update({ status: "done", completed_at: new Date().toISOString() })
          .eq("reference_id", proposal.contribution_id)
          .eq("status", "pending");
      }

      setProposals((prev) =>
        prev?.map((p, i) => (i === index ? { ...p, applied: true } : p)) ?? null
      );
      toast.success("Verwerkt: " + proposal.member_name);
    } catch (e: any) {
      toast.error("Fout: " + e.message);
    } finally {
      setApplyingId(null);
    }
  };

  const handleClose = () => {
    if (proposals?.some((p) => p.applied)) {
      onComplete();
    }
    setProposals(null);
    setAutoApplied(0);
    setFileName("");
    onOpenChange(false);
  };

  const pendingProposals = proposals?.filter((p) => !p.applied && p.contribution_id) ?? [];
  const appliedProposals = proposals?.filter((p) => p.applied) ?? [];
  const unmatchedProposals = proposals?.filter((p) => !p.contribution_id && !p.applied) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} />
            Administratie bijwerken
          </DialogTitle>
          <DialogDescription>
            Upload een bankafschrift, facturenlijst of ander bestand. De administratie wordt automatisch bijgewerkt.
          </DialogDescription>
        </DialogHeader>

        {/* File upload area */}
        {!processing && !proposals && (
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Klik om een bestand te selecteren</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, CSV, Excel, afbeelding — elk formaat wordt ondersteund
            </p>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.txt"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Processing */}
        {processing && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 size={32} className="animate-spin text-primary" />
            <p className="text-sm font-medium">Bestand verwerken...</p>
            <p className="text-xs text-muted-foreground">{fileName} wordt geanalyseerd met AI</p>
          </div>
        )}

        {/* Results */}
        {proposals && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground"> — </span>
                <span>{proposals.length} transacties gevonden</span>
                {autoApplied > 0 && (
                  <span className="text-green-700">, {autoApplied} automatisch verwerkt</span>
                )}
              </div>
            </div>

            {/* Auto-applied */}
            {appliedProposals.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  ✅ Verwerkt ({appliedProposals.length})
                </h4>
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden opacity-75">
                  {appliedProposals.map((p, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm">
                      <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                      <span className="flex-1">{p.member_name}</span>
                      <span className="tabular-nums font-medium">{fmt(p.amount)}</span>
                      <Badge className={`text-[10px] ${confidenceColors[p.confidence]}`}>
                        {confidenceLabels[p.confidence]}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending proposals */}
            {pendingProposals.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  ⏳ Ter bevestiging ({pendingProposals.length})
                </h4>
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  {pendingProposals.map((p, idx) => {
                    const realIdx = proposals.indexOf(p);
                    return (
                      <div key={idx} className="px-4 py-3 space-y-1">
                        <div className="flex items-center gap-3">
                          <AlertCircle size={14} className="text-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{p.member_name}</span>
                              <Badge className={`text-[10px] ${confidenceColors[p.confidence]}`}>
                                {confidenceLabels[p.confidence]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {typeLabels[p.type] || p.type}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                          </div>
                          <span className="tabular-nums font-medium text-sm shrink-0">{fmt(p.amount)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => applyProposal(p, realIdx)}
                            disabled={applyingId === p.contribution_id}
                          >
                            {applyingId === p.contribution_id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={10} />
                            )}
                            Verwerk
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unmatched */}
            {unmatchedProposals.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  ❌ Niet gematcht ({unmatchedProposals.length})
                </h4>
                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden opacity-60">
                  {unmatchedProposals.map((p, i) => (
                    <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm">
                      <XCircle size={14} className="text-muted-foreground shrink-0" />
                      <span className="flex-1">{p.member_name}</span>
                      <span className="tabular-nums">{fmt(p.amount)}</span>
                      <span className="text-xs text-muted-foreground">{p.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => {
                setProposals(null);
                setAutoApplied(0);
                setFileName("");
              }}>
                Nog een bestand uploaden
              </Button>
              <Button size="sm" onClick={handleClose}>
                Sluiten
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
