import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { PREFLIGHT_LABEL, parsePreflight, preflightSummary, type PreflightRow } from "@/lib/paidPreflightView";

type Decl = { id: string; amount: number; expense_date: string; board_member_name: string | null; budget_line_item_id?: string | null; dossier?: string | null; status: string; year?: number };

const eur = (cents: number) => (cents / 100).toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
const month = (d: string) => new Date(d).toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

/** Admin: alleen-lezen controle van betaalde declaraties tegen Informer + overzicht van nog niet ingedeelde declaraties. */
export default function PaidPreflightPanel({ declarations, invoke = invokeWithAuth }: { declarations: Decl[]; invoke?: typeof invokeWithAuth }) {
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<PreflightRow[] | null>(null);
  const [checked, setChecked] = useState(0);
  const [at, setAt] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const byId = new Map(declarations.map((d) => [d.id, d]));
  const unassigned = declarations.filter((d) => !d.budget_line_item_id && d.status !== "rejected");

  const run = async () => {
    setBusy(true); setErr(null);
    try {
      const { data, error } = await invoke("informer-sync?action=paid_declarations_preflight", { body: {} });
      const p = parsePreflight(data, error as any);
      if (!p.ok) { setErr(p.message); return; }
      setRows(p.rows); setChecked(p.checked); setAt(new Date());
    } finally { setBusy(false); }
  };
  const summary = rows ? preflightSummary(rows, new Map(declarations.map((d) => [d.id, Number(d.amount)]))) : null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Controle administratie</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-2">
          <Button onClick={run} disabled={busy}>{busy ? "Bezig met controleren…" : "Controleer betaalde declaraties in Informer"}</Button>
          <p className="text-muted-foreground">Alleen controleren: er wordt niets geboekt, aangemaakt of als betaald gemarkeerd. Informer kan een bestaande bankbetaling niet via de koppeling aan een factuur hangen; afletteren gebeurt handmatig in Informer.</p>
          {err && <p role="alert" className="text-destructive">{err}</p>}
          {rows && at && (
            <div data-testid="preflight-result" className="space-y-2">
              <p>Gecontroleerd op {at.toLocaleString("nl-NL")} tegen {checked} inkoopfacturen in Informer.</p>
              <ul className="flex flex-wrap gap-3">
                {summary && Object.entries(summary).filter(([, v]) => v.count > 0).map(([k, v]) => (
                  <li key={k}>{PREFLIGHT_LABEL[k as keyof typeof PREFLIGHT_LABEL]}: {v.count} ({eur(v.cents)})</li>
                ))}
              </ul>
              <table className="w-full text-left">
                <thead><tr><th>Maand</th><th>Naam</th><th className="text-right">Bedrag</th><th>Status</th></tr></thead>
                <tbody>
                  {rows.map((r) => { const d = byId.get(r.declaration_id); return (
                    <tr key={r.declaration_id} className="border-t">
                      <td>{d ? month(d.expense_date) : "—"}</td><td>{d?.board_member_name ?? "—"}</td>
                      <td className="text-right tabular-nums">{d ? eur(Math.round(Number(d.amount) * 100)) : "—"}</td>
                      <td>{PREFLIGHT_LABEL[r.status]}</td>
                    </tr>); })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <p className="font-medium">Nog in te delen ({unassigned.length})</p>
          {unassigned.length === 0 ? <p className="text-muted-foreground">Alle declaraties van dit jaar hebben een post.</p> : (
            <ul className="list-disc pl-5">
              {unassigned.map((d) => <li key={d.id}>{month(d.expense_date)} · {d.board_member_name ?? "—"} · {eur(Math.round(Number(d.amount) * 100))} — gebruik “Indelen” in de lijst hieronder</li>)}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
