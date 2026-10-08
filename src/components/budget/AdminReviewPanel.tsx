import { reviewKey } from "@/lib/reviewKey";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { contributionEvidence, closedYearsFromAttempts, contributionsToReview, declarationsToReview, countWithoutDossier, ledgerExceptions, type DeclLite } from "@/lib/adminReview";

const eur = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });


/** Admin: leest actuele data (RLS: alleen admins) en toont wat nog beoordeeld moet worden. Schrijft niets. */
/** Haalt alle rijen op in pagina's van 1000 (Data API-limiet). */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, page = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < page) return out;
  }
}


/** Admin: leest actuele data (RLS: alleen admins) en toont wat nog beoordeeld moet worden. Schrijft niets. */
export function useAdminReview(year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-review", year],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [contrib, ponto, bank, ledger, overrides, expenses, links, items, attempts, cLinks, declBank] = await Promise.all([
        fetchAll<any>((f, t) => supabase.from("member_contributions").select("id, member_id, year, amount, paid, external_invoice_id").eq("year", year).eq("paid", true).order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("ponto_transactions").select("dossier, amount, executed_at, value_date").not("dossier", "is", null).gt("amount", 0).order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("bank_transactions").select("id, amount, invoice_reference, dossier, year, direction").not("dossier", "is", null).eq("direction", "in").eq("year", year).order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("informer_ledger_entries").select("informer_id, doc_type, ledger_account, amount_incl, relation_name, entry_date").eq("year", year).in("doc_type", ["purchase_invoice", "receipt"]).is("deleted_at", null).order("informer_id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("ledger_entry_overrides").select("informer_id, doc_type, line_item_id, dossier").in("doc_type", ["purchase_invoice", "receipt"]).order("informer_id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("budget_expenses").select("external_id, line_item_id, amount, source").not("external_id", "is", null).order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("ledger_payment_links").select("informer_id, ponto_transaction_id").order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("budget_line_items").select("id, name").order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("internal_declaration_sync_attempts").select("sanitized_error, internal_declarations(expense_date)").not("sanitized_error", "is", null).order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("contribution_bank_links").select("contribution_id, bank_transaction_id").order("id").range(f, t)),
        fetchAll<any>((f, t) => supabase.from("internal_declarations").select("bank_transaction_id").not("bank_transaction_id", "is", null).order("id").range(f, t)),
      ]);
      const declTx = new Set(declBank.map((d: any) => String(d.bank_transaction_id)));
      const evidence = contributionEvidence(contrib, bank.map((b: any) => ({ id: b.id, amount: Math.abs(Number(b.amount)), year: Number(b.year), dossier: b.dossier, invoice_reference: b.invoice_reference, declLinked: declTx.has(String(b.id)) })), cLinks, year);
      const itemName = new Map(items.map((i: any) => [i.id, i.name as string]));
      // Informer-ID's zijn niet uniek over documentsoorten: bonnetjes krijgen een eigen sleutel.
      const ovPost = new Map(overrides.map((o: any) => [reviewKey(o.doc_type, o.informer_id), o.line_item_id]));
      const ovDossier = new Map(overrides.map((o: any) => [reviewKey(o.doc_type, o.informer_id), o.dossier]));
      const legacy = new Map<string, { id: string | null; name: string }>();
      for (const e of expenses) if (!(e.source === "informer" && Number(e.amount) === 0) && e.line_item_id) legacy.set(e.external_id, { id: e.line_item_id, name: itemName.get(e.line_item_id) ?? "Onbekende post" });
      const linkIds = [...new Set(links.map((l: any) => l.ponto_transaction_id))];
      const tx: any[] = [];
      for (let i = 0; i < linkIds.length; i += 200) {
        const { data, error } = await supabase.from("ponto_transactions").select("id, budget_line_item_id, dossier").in("id", linkIds.slice(i, i + 200));
        if (error) throw error;
        tx.push(...(data ?? []));
      }
      const txById = new Map(tx.map((t) => [t.id, t]));
      for (const l of links) {
        const t: any = txById.get(l.ponto_transaction_id);
        if (t?.budget_line_item_id && !legacy.has(l.informer_id)) legacy.set(l.informer_id, { id: t.budget_line_item_id, name: itemName.get(t.budget_line_item_id) ?? "Onbekende post" });
        if (t?.dossier && !ovDossier.get(l.informer_id)) ovDossier.set(l.informer_id, t.dossier);
      }
      const bankTags = [
        ...bank.map((b: any) => ({ dossier: b.dossier, year: Number(b.year), incoming: b.direction === "in" })),
        ...ponto.map((p: any) => ({ dossier: p.dossier, year: Number(String(p.value_date ?? p.executed_at ?? "").slice(0, 4)), incoming: Number(p.amount) > 0 })),
      ];
      const pre = contributionsToReview(contrib, bankTags, new Map(), year);
      const ids = [...new Set(pre.map((c) => c.member_id))];
      const names = new Map<number, string>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase.from("members_data").select("id, naam:data->>naam, bedrijf:data->>bedrijfsnaam").in("id", ids.slice(i, i + 200));
        if (error) throw error;
        for (const m of (data ?? []) as any[]) names.set(Number(m.id), String(m.naam ?? m.bedrijf ?? `Lid ${m.id}`));
      }
      return {
        evidence,
        contributions: pre.map((c) => ({ ...c, name: names.get(c.member_id) ?? c.name })),
        exceptions: ledgerExceptions(ledger.map((l: any) => ({ ...l, informer_id: reviewKey(l.doc_type, l.informer_id) })), ovPost, legacy, ovDossier, itemName),
        closedYears: closedYearsFromAttempts(attempts.map((a: any) => ({ sanitized_error: a.sanitized_error, year: Number(String(a.internal_declarations?.expense_date ?? "").slice(0, 4)) }))),
      };
    },
  });
}

export default function AdminReviewPanel({ year, declarations }: { year: number; declarations: DeclLite[] }) {
  const q = useAdminReview(year, true);
  const decl = declarationsToReview(declarations, q.data?.closedYears ?? []);
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Nog te beoordelen</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">Alleen overzicht: hier wordt niets gefactureerd, geboekt of overschreven.</p>
        <section>
          <p className="font-medium">Declaraties ({decl.length}) · zonder dossier: {countWithoutDossier(declarations)}</p>
          <ul className="list-disc pl-5">{decl.map((r, i) => <li key={r.id + i}>{r.label} — {r.reason}</li>)}</ul>
          <p className="text-muted-foreground">Een dossier kies je met Indelen; er is geen bank- of Informerdossier om automatisch over te nemen.</p>
        </section>
        {q.isLoading && <p>Laden…</p>}
        {q.error && <p role="alert" className="text-destructive">Overzicht kon niet worden geladen.</p>}
        {q.data && (
          <>
            <section>
              <p className="font-medium">Boekingen met afwijkende post ({q.data.exceptions.length})</p>
              <ul className="list-disc pl-5">{q.data.exceptions.map((e) => (
                <li key={e.informer_id}>{String(e.informer_id).startsWith("receipt:") ? "Bonnetje · " : ""}{e.entry_date} · {e.relation_name ?? "—"} · {eur(Number(e.amount_incl ?? 0))} · rekening {e.ledger_account} — nu {e.manual ? "handmatig " : ""}op “{e.currentPost}”{e.dossier ? `, dossier ${e.dossier}` : ""}; regel zou “{e.intended}” geven. Niet overschreven; aanpassen via Boekingen.</li>
              ))}</ul>
            </section>
            <section>
              <p className="font-medium">Contributie met bankbewijs-uitzondering ({q.data.evidence.exceptions.length})</p>
              <ul className="list-disc pl-5">{q.data.evidence.exceptions.map((e) => (
                <li key={e.contribution_id}>Lid #{e.member_id} · contributie {eur(e.amount)} · bank {eur(e.bank_total)} ({e.bank_ids.length} ontvangst{e.bank_ids.length === 1 ? "" : "en"}) — {e.reason}. Niet gekoppeld.</li>
              ))}</ul>
            </section>
            <details>
              <summary className="font-medium cursor-pointer">Bewezen bankkoppelingen ({q.data.evidence.linked.length}, {eur(q.data.evidence.linked.reduce((s, e) => s + e.amount, 0))})</summary>
              <ul className="list-disc pl-5">{q.data.evidence.linked.map((e) => (
                <li key={e.contribution_id}>Lid #{e.member_id} · {eur(e.amount)} · contributie {e.contribution_id.slice(0, 8)} ↔ bankregel {e.bank_ids[0].slice(0, 8)}</li>
              ))}</ul>
            </details>
            <section>
              <p className="font-medium">Betaalde contributie zonder factuur of bankdossier ({q.data.contributions.length}, {eur(q.data.contributions.reduce((s, c) => s + c.amount, 0))})</p>
              <table className="w-full text-left">
                <thead><tr><th>Lid</th><th>Jaar</th><th className="text-right">Bedrag</th><th>Waarom</th></tr></thead>
                <tbody>{q.data.contributions.map((c) => (
                  <tr key={c.id} className="border-t"><td>{c.name} (#{c.member_id})</td><td>{c.year}</td><td className="text-right tabular-nums">{eur(c.amount)}</td><td>{c.reason}</td></tr>
                ))}</tbody>
              </table>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
