import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Filter, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { useBudgetCategories } from "@/hooks/useBudget";

interface PontoTx {
  id: string;
  account_id: string;
  transaction_id: string;
  executed_at: string | null;
  amount: number;
  currency: string | null;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  description: string | null;
  remittance_info: string | null;
  dossier: string | null;
  budget_line_item_id: string | null;
  matched_manually: boolean;
  matched_rule_id: string | null;
}

interface Rule {
  id: string;
  pattern: string;
  match_field: string;
  budget_line_item_id: string | null;
  dossier: string | null;
  priority: number;
}

export default function BankboekingenTab({ year }: { year: number }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unmatched" | "matched">("all");
  const [syncing, setSyncing] = useState(false);

  const { data: categories } = useBudgetCategories(year, "manual");
  const allLineItems = useMemo(
    () => (categories || []).flatMap((c) =>
      c.line_items.map((li) => ({ id: li.id, label: `${c.name} · ${li.name}` }))
    ),
    [categories],
  );
  const lineItemLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const li of allLineItems) m.set(li.id, li.label);
    return m;
  }, [allLineItems]);

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const { data: txs, isLoading } = useQuery({
    queryKey: ["ponto_transactions", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_transactions")
        .select("*")
        .gte("executed_at", yearStart)
        .lt("executed_at", yearEnd)
        .order("executed_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as PontoTx[];
    },
  });

  const { data: rules } = useQuery({
    queryKey: ["ponto_matching_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ponto_matching_rules")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Rule[];
    },
  });

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return (txs ?? []).filter((t) => {
      if (statusFilter === "matched" && !t.budget_line_item_id) return false;
      if (statusFilter === "unmatched" && t.budget_line_item_id) return false;
      if (!q) return true;
      return [t.counterparty_name, t.description, t.remittance_info, t.dossier]
        .some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [txs, filter, statusFilter]);

  const totals = useMemo(() => {
    let inc = 0, out = 0;
    for (const t of filtered) {
      if (Number(t.amount) >= 0) inc += Number(t.amount);
      else out += Math.abs(Number(t.amount));
    }
    return { inc, out, net: inc - out };
  }, [filtered]);

  const runSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await invokeWithAuth<{ success: boolean; transactions_processed: number; rule_matches: number; error?: string }>(
        "ponto-sync?action=transactions", { method: "POST" },
      );
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "onbekende fout");
      toast.success(`${data.transactions_processed} boekingen opgehaald, ${data.rule_matches} automatisch gekoppeld`);
      qc.invalidateQueries({ queryKey: ["ponto_transactions"] });
    } catch (e) {
      toast.error(`Sync mislukt: ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const updateTx = async (id: string, patch: Partial<PontoTx>) => {
    const { error } = await supabase.from("ponto_transactions").update({
      ...patch,
      matched_manually: true,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["ponto_transactions"] });
  };

  const createRule = async (tx: PontoTx, lineItemId: string) => {
    const pattern = (tx.counterparty_name || tx.description || "").trim();
    if (!pattern || !lineItemId) return;
    const { error } = await supabase.from("ponto_matching_rules").insert({
      pattern, match_field: "counterparty", budget_line_item_id: lineItemId, dossier: tx.dossier,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Regel opgeslagen: "${pattern}" → ${lineItemLabel.get(lineItemId)}`);
    qc.invalidateQueries({ queryKey: ["ponto_matching_rules"] });
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="border border-border rounded-lg p-3 bg-card flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-muted-foreground" />
        <Input
          placeholder="Filter op tegenpartij, omschrijving of dossier…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-8 flex-1 min-w-[220px]"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="unmatched">Nog te categoriseren</SelectItem>
            <SelectItem value="matched">Gekoppeld</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground ml-auto flex gap-4 tabular-nums">
          <span>In: <CurrencyText value={totals.inc} /></span>
          <span>Uit: <CurrencyText value={totals.out} /></span>
          <span>Netto: <CurrencyText value={totals.net} /></span>
        </div>
        <Button size="sm" onClick={runSync} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Ophalen…" : "Ponto ophalen"}
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-card">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Laden…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Geen boekingen.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Tegenpartij / omschrijving</th>
                <th className="px-3 py-2 font-medium text-right">Bedrag</th>
                <th className="px-3 py-2 font-medium">Begrotingspost</th>
                <th className="px-3 py-2 font-medium">Dossier</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-xs whitespace-nowrap">
                    {t.executed_at ? new Date(t.executed_at).toLocaleDateString("nl-NL") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{t.counterparty_name || "—"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {t.description || t.remittance_info || ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    <span className={Number(t.amount) < 0 ? "text-destructive" : "text-green-600"}>
                      <CurrencyText value={Number(t.amount)} />
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="border border-border rounded px-2 py-1 text-xs bg-background w-full max-w-[220px]"
                      value={t.budget_line_item_id ?? ""}
                      onChange={(e) => updateTx(t.id, { budget_line_item_id: e.target.value || null })}
                    >
                      <option value="">— niet gekoppeld —</option>
                      {allLineItems.map((li) => (
                        <option key={li.id} value={li.id}>{li.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="border border-border rounded px-2 py-1 text-xs bg-background w-full max-w-[160px]"
                      value={t.dossier ?? ""}
                      placeholder="—"
                      onChange={(e) => updateTx(t.id, { dossier: e.target.value || null })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {t.budget_line_item_id && (t.counterparty_name || t.description) && (
                      <button
                        title="Onthoud deze koppeling voor vergelijkbare boekingen"
                        className="text-xs text-muted-foreground hover:text-brand-red inline-flex items-center gap-1"
                        onClick={() => createRule(t, t.budget_line_item_id!)}
                      >
                        <Wand2 size={12} /> Regel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(rules?.length ?? 0) > 0 && (
        <div className="border border-border rounded-lg bg-card">
          <div className="px-3 py-2 border-b border-border bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Matchregels ({rules!.length})
          </div>
          <table className="w-full text-sm">
            <tbody>
              {rules!.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5 font-medium">{r.pattern}</td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                    → {r.budget_line_item_id ? (lineItemLabel.get(r.budget_line_item_id) || "onbekende post") : "—"}
                    {r.dossier ? ` · ${r.dossier}` : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        await supabase.from("ponto_matching_rules").delete().eq("id", r.id);
                        qc.invalidateQueries({ queryKey: ["ponto_matching_rules"] });
                      }}
                    >verwijder</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}