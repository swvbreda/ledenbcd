import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useBudgetCategories } from "@/hooks/useBudget";
import { CurrencyText } from "@/components/budget/CurrencyAmount";

interface Props {
  todoId: string;
  transactionId: string;
  year: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

type Mode = "contribution" | "budget";

export default function LinkBankTransactionDialog({
  todoId,
  transactionId,
  year,
  open,
  onOpenChange,
  onLinked,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [mode, setMode] = useState<Mode>("contribution");
  const [memberId, setMemberId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [lineItemId, setLineItemId] = useState<string>("");
  const [dossier, setDossier] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const { data: tx } = useQuery({
    queryKey: ["ponto_tx", transactionId],
    enabled: open && !!transactionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_transactions")
        .select("*")
        .eq("id", transactionId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["members_pick_list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members_data")
        .select("id, member_type, data");
      if (error) throw error;
      return (data ?? [])
        .filter((m: any) => m.member_type === "member")
        .map((m: any) => ({
          id: Number(m.id),
          name: m.data?.naam || m.data?.bedrijfsnaam || `Lid #${m.id}`,
          city: m.data?.plaats || "",
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "nl"));
    },
  });

  const { data: categories } = useBudgetCategories(year, "manual");
  const allLineItems = useMemo(
    () =>
      (categories || []).flatMap((c) =>
        c.line_items.map((li) => ({ id: li.id, label: `${c.name} · ${li.name}` }))
      ),
    [categories]
  );

  useEffect(() => {
    if (tx) {
      setAmount(String(Math.abs(Number(tx.amount || 0))));
    }
  }, [tx]);

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members.slice(0, 50);
    return members.filter((m) =>
      `${m.name} ${m.city} #${m.id}`.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [members, memberSearch]);

  const handleSave = async () => {
    if (!tx) return;
    setSaving(true);
    try {
      if (mode === "contribution") {
        if (!memberId) throw new Error("Kies een lid");
        const amt = Number(amount);
        if (!Number.isFinite(amt) || amt <= 0) throw new Error("Ongeldig bedrag");

        const memId = Number(memberId);
        const paidAt = tx.executed_at || new Date().toISOString();

        const { error: payErr } = await supabase.from("contribution_payments").insert({
          member_id: memId,
          year,
          amount: amt,
          status: "paid",
          payment_method: "bank",
          paid_at: paidAt,
          created_by: user?.id,
        });
        if (payErr) throw payErr;

        const { error: txErr } = await supabase
          .from("ponto_transactions")
          .update({
            dossier: `Contributie #${memId}`,
            matched_manually: true,
            match_strategy: "manual",
          })
          .eq("id", tx.id);
        if (txErr) throw txErr;
      } else {
        if (!lineItemId) throw new Error("Kies een begrotingspost");
        const { error: txErr } = await supabase
          .from("ponto_transactions")
          .update({
            budget_line_item_id: lineItemId,
            dossier: dossier.trim() || null,
            matched_manually: true,
            match_strategy: "manual",
          })
          .eq("id", tx.id);
        if (txErr) throw txErr;
      }

      const { error: doneErr } = await supabase
        .from("finance_todos")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", todoId);
      if (doneErr) throw doneErr;

      toast.success("Boeking gekoppeld");
      qc.invalidateQueries({ queryKey: ["finance-todos", year] });
      qc.invalidateQueries({ queryKey: ["ponto_transactions"] });
      qc.invalidateQueries({ queryKey: ["contributions"] });
      qc.invalidateQueries({ queryKey: ["contribution-invoices"] });
      onLinked();
      onOpenChange(false);
    } catch (e) {
      toast.error("Koppelen mislukt: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bankboeking koppelen</DialogTitle>
        </DialogHeader>

        {!tx ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{tx.counterparty_name || "—"}</span>
                <span className="tabular-nums text-green-700">
                  <CurrencyText value={Number(tx.amount)} />
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {tx.executed_at ? new Date(tx.executed_at).toLocaleDateString("nl-NL") : ""} · {tx.counterparty_iban || "geen IBAN"}
              </div>
              {(tx.description || tx.remittance_info) && (
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {tx.description || tx.remittance_info}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "contribution" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMode("contribution")}
              >
                Contributie van lid
              </Button>
              <Button
                type="button"
                variant={mode === "budget" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setMode("budget")}
              >
                Andere begrotingspost
              </Button>
            </div>

            {mode === "contribution" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Lid</Label>
                  <Input
                    placeholder="Zoek op naam, plaats of #lidnummer…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <div className="border border-border rounded-md max-h-48 overflow-auto divide-y divide-border">
                    {filteredMembers.length === 0 ? (
                      <div className="text-xs text-muted-foreground p-2">Geen leden gevonden.</div>
                    ) : (
                      filteredMembers.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMemberId(String(m.id))}
                          className={`w-full text-left px-2 py-1.5 text-xs hover:bg-muted transition-colors ${
                            memberId === String(m.id) ? "bg-primary/10 font-medium" : ""
                          }`}
                        >
                          <span className="text-muted-foreground tabular-nums mr-2">#{m.id}</span>
                          {m.name}
                          {m.city && <span className="text-muted-foreground ml-1">· {m.city}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bedrag ({year})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Begrotingspost</Label>
                  <Select value={lineItemId} onValueChange={setLineItemId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Kies begrotingspost…" />
                    </SelectTrigger>
                    <SelectContent>
                      {allLineItems.map((li) => (
                        <SelectItem key={li.id} value={li.id} className="text-xs">
                          {li.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Dossier (optioneel)</Label>
                  <Input
                    value={dossier}
                    onChange={(e) => setDossier(e.target.value)}
                    placeholder="Bijv. Congres 2026"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuleer
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              !tx ||
              (mode === "contribution" ? !memberId : !lineItemId)
            }
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            Koppelen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}