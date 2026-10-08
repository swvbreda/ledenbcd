import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { contributionsToReview, declarationsToReview, countWithoutDossier, ledgerExceptions, type DeclLite } from "@/lib/adminReview";

const eur = (n: number) => n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });

/** Admin: leest actuele data (RLS: alleen admins) en toont wat nog beoordeeld moet worden. Schrijft niets. */
export function useAdminReview(year: number, enabled: boolean) {
  return useQuery({
    queryKey: ["admin-review", year],
    enabled,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [contrib, ponto, bank, members, ledger, overrides, expenses, links, items] = await Promise.all([
        supabase.from("member_contributions").select("id, member_id, year, amount, paid, external_invoice_id").eq("year", year).eq("paid", true),
        supabase.from("ponto_transactions").select("dossier").not("dossier", "is", null).limit(10000),
        supabase.from("bank_transactions").select("dossier").not("dossier", "is", null).limit(10000),
        supabase.from("members_data").select("id, data"),
        supabase.from("informer_ledger_entries").select("informer_id, ledger_account, amount_incl, relation_name, entry_date").eq("year", year).eq("doc_type", "purchase_invoice").is("deleted_at", null),
        supabase.from("ledger_entry_overrides").select("informer_id, line_item_id, dossier").eq("doc_type", "purchase_invoice"),
        supabase.from("budget_expenses").select("external_id, line_item_id, amount, source").not("external_id", "is", null),
        supabase.from("ledger_payment_links").select("informer_id, ponto_transaction_id"),
        supabase.from("budget_line_items").select("id, name"),
      ]);
      const err = [contrib, ponto, bank, members, ledger, overrides, expenses, links, items].find((r) => r.error)?.error;
      if (err) throw err;
      const names = new Map<number, string>((members.data ?? []).map((m: any) => [Number(m.id), String(m.data?.naam ?? m.data?.bedrijfsnaam ?? `Lid ${m.id}`)]));
      const itemName = new Map((items.data ?? []).map((i: any) => [i.id, i.name as string]));
      const ovPost = new Map((overrides.data ?? []).map((o: any) => [o.informer_id, o.line_item_id]));
      const ovDossier = new Map((overrides.data ?? []).map((o: any) => [o.informer_id, o.dossier]));
      const legacy = new Map<string, string>();
      for (const e of expenses.data ?? []) if (!(e.source === "informer" && Number(e.amount) === 0) && e.line_item_id) legacy.set(e.external_id!, itemName.get(e.line_item_id) ?? "Onbekende post");
      const linkIds = (links.data ?? []).map((l: any) => l.ponto_transaction_id);
      if (linkIds.length) {
        const { data: tx } = await supabase.from("ponto_transactions").select("id, budget_line_item_id, dossier").in("id", linkIds);
        const txById = new Map((tx ?? []).map((t: any) => [t.id, t]));
        for (const l of links.data ?? []) {
          const t: any = txById.get(l.ponto_transaction_id);
          if (t?.budget_line_item_id && !legacy.has(l.informer_id)) legacy.set(l.informer_id, itemName.get(t.budget_line_item_id) ?? "Onbekende post");
          if (t?.dossier && !ovDossier.get(l.informer_id)) ovDossier.set(l.informer_id, t.dossier);
        }
      }
      return {
        contributions: contributionsToReview((contrib.data ?? []) as any, [...(ponto.data ?? []), ...(bank.data ?? [])].map((r: any) => r.dossier), names, year),
        exceptions: ledgerExceptions((ledger.data ?? []) as any, ovPost, legacy, ovDossier),
      };
    },
  });
}

export default function AdminReviewPanel({ year, declarations, closedYears = [2025] }: { year: number; declarations: DeclLite[]; closedYears?: number[] }) {
  const q = useAdminReview(year, true);
  const decl = declarationsToReview(declarations, closedYears);
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
              <p className="font-medium">Boekingen met afwijkende eerdere post ({q.data.exceptions.length})</p>
              <ul className="list-disc pl-5">{q.data.exceptions.map((e) => (
                <li key={e.informer_id}>{e.entry_date} · {e.relation_name ?? "—"} · {eur(Number(e.amount_incl ?? 0))} · rekening {e.ledger_account} — nu op “{e.currentPost}”{e.dossier ? `, dossier ${e.dossier}` : ""}; regel zou “{e.intended}” geven. Niet overschreven; aanpassen via Boekingen.</li>
              ))}</ul>
            </section>
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
