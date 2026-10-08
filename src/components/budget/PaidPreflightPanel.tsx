import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { PREFLIGHT_LABEL, parseBook, parsePreflight, preflightSummary, type BookResult, type PreflightRow } from "@/lib/paidPreflightView";

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
  const [booking, setBooking] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [book, setBook] = useState<{ results: BookResult[]; blocked: { declaration_id: string; reason: string }[] } | null>(null);
  const ready = (rows ?? []).filter((r) => r.status === "klaar_voor_handmatige_aflettering").map((r) => r.declaration_id);
  const runBook = async () => {
    setBooking(true); setErr(null);
    try {
      const { data, error } = await invoke("informer-sync?action=paid_declarations_book", { body: { declaration_ids: ready } });
      const p = parseBook(data, error as any);
      if (!p.ok) { setErr(p.message); return; }
      setBook({ results: p.results, blocked: p.blocked }); setConfirm(false);
    } finally { setBooking(false); }
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
              {ready.length > 0 && !book && (
                <div className="space-y-2 rounded border p-3" data-testid="book-paid">
                  <p className="font-medium">Deze declaraties zijn al betaald. Opnemen maakt per declaratie één inkoopfactuur in Informer (bestaande referentie). Er wordt géén betaling of bankboeking aangemaakt; daarna moet je in Informer handmatig afletteren tegen de bestaande bankbetaling.</p>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> Ik begrijp dat afletteren daarna handmatig nodig is</label>
                  <Button onClick={runBook} disabled={!confirm || booking}>{booking ? "Bezig met opnemen…" : `Betaalde declaraties opnemen in Informer (${ready.length})`}</Button>
                </div>
              )}
              {book && (
                <div data-testid="book-result" className="space-y-1">
                  <p className="font-medium">Opgenomen — aflettering nog nodig</p>
                  <ul className="list-disc pl-5">{book.results.map((r) => { const d = byId.get(r.declaration_id); return (
                    <li key={r.declaration_id}>{d ? month(d.expense_date) : "—"} · {d?.board_member_name ?? "—"} · {r.reference} — {r.outcome === "created" ? `nieuw document ${r.informer_document_id}` : r.outcome === "reused" ? `bestaand document ${r.informer_document_id} hergebruikt` : `mislukt: ${r.error ?? "onbekend"}`}{r.bank_transaction_id ? ` · afletteren tegen bankbetaling ${r.bank_date ?? ""} ${r.bank_amount != null ? eur(Math.round(r.bank_amount * 100)) : ""} (bankregel ${r.bank_transaction_id})` : ""}</li>); })}</ul>
                  {book.blocked.length > 0 && <ul className="list-disc pl-5 text-muted-foreground">{book.blocked.map((b) => <li key={b.declaration_id}>Niet opgenomen: {b.reason}</li>)}</ul>}
                </div>
              )}
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
