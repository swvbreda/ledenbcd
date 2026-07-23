import { useEffect, useState } from "react";
import { Banknote, Link2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Row {
  todo_id: string;
  transaction_id: string;
  amount: number;
  executed_at: string;
  counterparty_name: string | null;
  counterparty_iban: string | null;
  remittance_info: string | null;
  description: string | null;
}

interface Props {
  refreshKey?: number;
  onLink: (todoId: string, transactionId: string) => void;
}

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("nl-NL", { day: "2-digit", month: "short", year: "numeric" });

const extractOmschrijving = (r: Row): string => {
  const src = r.remittance_info || r.description || "";
  const m = src.match(/Omschrijving:\s*(.+?)(?:\s+Kenmerk:|\s*$)/i);
  if (m) return m[1].trim();
  return src.slice(0, 140);
};

export default function UnmatchedBankTransactionsPanel({ refreshKey, onLink }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: todos } = await supabase
        .from("finance_todos")
        .select("id, reference_id")
        .eq("todo_type", "manual_bank_match")
        .eq("status", "pending");
      const ids = (todos ?? [])
        .map((t: any) => t.reference_id)
        .filter((x: string | null): x is string => !!x);
      if (ids.length === 0) {
        if (!cancelled) { setRows([]); setLoading(false); }
        return;
      }
      const { data: txs } = await supabase
        .from("ponto_transactions")
        .select("id, amount, executed_at, counterparty_name, counterparty_iban, remittance_info, description")
        .in("id", ids);
      const byId = new Map<string, any>((txs ?? []).map((t: any) => [t.id, t]));
      const merged: Row[] = (todos ?? [])
        .map((t: any) => {
          const tx = byId.get(t.reference_id);
          if (!tx) return null;
          return {
            todo_id: t.id,
            transaction_id: tx.id,
            amount: Number(tx.amount),
            executed_at: tx.executed_at,
            counterparty_name: tx.counterparty_name,
            counterparty_iban: tx.counterparty_iban,
            remittance_info: tx.remittance_info,
            description: tx.description,
          };
        })
        .filter((x: Row | null): x is Row => !!x)
        .sort((a, b) => (a.executed_at < b.executed_at ? 1 : -1));
      if (!cancelled) { setRows(merged); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="border border-border rounded-lg p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" /> Bankboekingen laden…
      </div>
    );
  }
  if (rows.length === 0) return null;

  const totaal = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="border border-purple-200 bg-purple-50/40 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-purple-200 bg-purple-50">
        <div className="flex items-center gap-2">
          <Banknote size={14} className="text-purple-700" />
          <span className="text-xs font-semibold uppercase tracking-wide text-purple-900">
            Niet-toegewezen bankboekingen
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{rows.length}</Badge>
        </div>
        <span className="text-xs text-purple-900 tabular-nums font-medium">
          Totaal: {fmtEUR(totaal)}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-purple-50/60 text-[10px] uppercase text-purple-900/70">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Datum</th>
              <th className="text-right px-3 py-2 font-medium">Bedrag</th>
              <th className="text-left px-3 py-2 font-medium">Tegenpartij</th>
              <th className="text-left px-3 py-2 font-medium">IBAN</th>
              <th className="text-left px-3 py-2 font-medium">Omschrijving</th>
              <th className="text-right px-3 py-2 font-medium">Actie</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-100">
            {rows.map((r) => (
              <tr key={r.todo_id} className="hover:bg-purple-50/50">
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.executed_at)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{fmtEUR(r.amount)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.counterparty_name || "—"}</td>
                <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                  {r.counterparty_iban || "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground max-w-[420px] truncate" title={extractOmschrijving(r)}>
                  {extractOmschrijving(r)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => onLink(r.todo_id, r.transaction_id)}
                  >
                    <Link2 size={12} /> Koppelen
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}