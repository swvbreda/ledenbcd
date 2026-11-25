import { useMemo, useState } from "react";
import { ChevronDown, StickyNote } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import BankBalancesCard from "@/components/budget/BankBalancesCard";
import BudgetVsActualTable from "@/components/budget/BudgetVsActualTable";
import BudgetCategoryTable from "@/components/budget/BudgetCategoryTable";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";
import { getBegroting2027 } from "@/lib/begroting2027.functions";
import ContributieInkomsten2027 from "@/components/budget/ContributieInkomsten2027";

type Line = { name: string; budgeted: number; actual2026: number | null; basis: string };
const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const noop = () => {};

/** Zet conceptregels om naar de vorm van de bestaande begrotingstabellen (zonder boekingen). */
export function toCategories(cats: { name: string; lines: Line[] }[]): BudgetCategory[] {
  return cats.map((c, i) => ({
    id: `c2027-${i}`, year: 2027, name: c.name, sort_order: i,
    line_items: c.lines.map((l, j) => ({ id: `c2027-${i}-${j}`, category_id: `c2027-${i}`, name: l.name, budgeted_amount: l.budgeted, sort_order: j, expenses: [] })),
  }));
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-2 bg-muted/50 px-3 py-2"><h3 className="text-sm font-semibold">{title}</h3></div>
      {children}
    </div>
  );
}

export default function Begroting2027Tab() {
  const fetchConcept = useServerFn(getBegroting2027);
  const { data: B, isLoading, isError } = useQuery({ queryKey: ["begroting-2027-concept"], queryFn: () => fetchConcept(), retry: false, staleTime: Infinity });
  const [detail, setDetail] = useState<Line | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);

  const view = useMemo(() => {
    if (!B) return null;
    const income = B.totalFull;
    const inkomsten = B.inkomsten.map((l) => (l.name === "Contributies" ? { ...l, budgeted: income } : l));
    const all = [{ name: "Inkomsten", lines: inkomsten }, ...B.uitgaven];
    const lookup = new Map<string, Line>();
    all.forEach((c, i) => c.lines.forEach((l, j) => lookup.set(`c2027-${i}-${j}`, l)));
    const expenses = B.uitgaven.reduce((s, c) => s + c.lines.reduce((t, l) => t + l.budgeted, 0), 0);
    const other = inkomsten.filter((l) => l.name !== "Contributies").reduce((s, l) => s + l.budgeted, 0);
    return { categories: toCategories(all), lookup, expenses, income, other, result: income + other - expenses };
  }, [B]);

  if (isLoading) return <LoadingSpinner message="Concept laden..." />;
  if (isError || !B || !view) return <p className="text-sm text-muted-foreground">Dit concept kan niet worden geladen. Alleen beheerders kunnen het bekijken.</p>;

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="font-display text-xl uppercase">Begroting 2027</h2>
        <Badge variant="outline" className="border-primary text-primary">Concept</Badge>
        <span className="text-sm text-muted-foreground">Voorstel per {B.peildatum} · niet vastgesteld door de ALV</span>
      </div>

      <p className="mb-1 text-xs text-muted-foreground">Huidige banksaldi (actueel, geen beginsaldo voor 2027):</p>
      <BankBalancesCard />

      <div className="mt-4">
        <ContributieInkomsten2027 rows={B.rows} staffel={B.staffel} groups={B.groups} leden={B.leden} />
      </div>

      <div className="mt-4">
        <BudgetVsActualTable categories={view.categories} year={2027} concept />
        <p className="mt-2 text-xs text-muted-foreground">Ramingen, geen boekingen. Begrotingsruimte is geen banksaldo. Klik op een post voor de onderbouwing.</p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_420px]">
        <div className="space-y-3">
          {view.categories.map((cat) => (
            <BudgetCategoryTable
              key={cat.id}
              category={cat}
              readOnly
              noRealisation
              onAddLineItem={noop}
              onUpdateLineItem={noop}
              onDeleteLineItem={noop}
              onDeleteCategory={noop}
              onOpenExpenses={(id) => setDetail(view.lookup.get(id) ?? null)}
            />
          ))}
          <div className="overflow-x-auto rounded-lg border border-border bg-primary/5 overscroll-x-contain">
            <table className="w-full min-w-[38rem] text-sm">
              <colgroup><col className="w-[30%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[20%]" /><col className="w-[10%]" /></colgroup>
              <tbody>
                <tr className="font-bold">
                  <td className="px-3 py-2">Totaal begrote uitgaven</td>
                  <td className="px-3 py-2"><CurrencyCell value={view.expenses} /></td>
                  <td className="px-3 py-2 text-right text-muted-foreground" title="Nog geen realisatie opgenomen">—</td>
                  <td className="px-3 py-2"><CurrencyCell value={view.expenses} /></td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <Section title="Middelen balans">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border/50"><td className="px-3 py-1.5">Begrote uitgaven</td><td className="px-3 py-1.5 text-right"><CurrencyText value={view.expenses} /></td></tr>
                <tr className="border-b border-border/50"><td className="px-3 py-1.5">Begrote contributie</td><td className="px-3 py-1.5 text-right"><CurrencyText value={view.income} /></td></tr>
                <tr className="border-b border-border/50"><td className="px-3 py-1.5">Banksaldo 31 december 2026</td><td className="px-3 py-1.5 text-right text-muted-foreground">Nog vast te stellen</td></tr>
                <tr><td className="px-3 py-1.5">Reserve uit 2026</td><td className="px-3 py-1.5 text-right text-muted-foreground">Nog vast te stellen</td></tr>
              </tbody>
            </table>
          </Section>

          <p role="note" className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground">{B.werkgeverWaarschuwing}</p>

          <Section title="Resultaat (plan)">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border/50"><td className="px-3 py-1.5">Contributie (volledige staffel)</td><td className="px-3 py-1.5 text-right"><CurrencyText value={view.income} /></td></tr>
                <tr className="border-b border-border/50"><td className="px-3 py-1.5">Overige inkomsten</td><td className="px-3 py-1.5 text-right"><CurrencyText value={view.other} /></td></tr>
                <tr className="border-b border-border/50"><td className="px-3 py-1.5">Begrote uitgaven</td><td className="px-3 py-1.5 text-right"><CurrencyText value={view.expenses} /></td></tr>
                <tr className="bg-primary/5 font-semibold"><td className="px-3 py-2">Planresultaat 2027</td><td className={`px-3 py-2 text-right ${view.result < 0 ? "text-destructive" : ""}`}><CurrencyText value={view.result} /></td></tr>
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted-foreground">Contributie volgens de volledige staffel; niet vastgesteld, geen werkelijk resultaat.</p>
          </Section>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2"><StickyNote size={14} /><h3 className="text-sm font-semibold">Notities</h3></div>
            <div className="space-y-2 p-3 text-sm text-muted-foreground">
              <p>Begrotingsvoorstel per {B.peildatum}, niet vastgesteld door de ALV. Ramingen op basis van de begroting 2026, geboekte kosten en voorlopige aannames.</p>
              <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
                <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-foreground">
                  Meer toelichting <ChevronDown className={`h-3 w-3 text-brand-red transition-transform ${notesOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                    <li>De geboekte kosten van 2026 zijn mogelijk nog niet volledig.</li>
                    <li>Geen herberekening van btw; de BCD kan geen btw aftrekken.</li>
                    <li>Het nog niet toegewezen bedrag van € 7.500 uit 2026 en de voorgenomen premietarieven 2027 (AWf/Aof/WKO), de onbekende Whk en nog niet geregelde arbodienst/verzuimverzekering en salarisadministratie kunnen het totaal veranderen.</li>
                    <li>Geen automatische overdracht van reserves; PCN-terugbetalingen zijn niet meegerekend.</li>
                    <li>De begroting en boekingen van 2026 zijn niet aangepast.</li>
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.name}</DialogTitle>
            <DialogDescription>Raming 2027 (concept)</DialogDescription>
          </DialogHeader>
          {detail && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Begroot 2027</dt><dd><CurrencyText value={detail.budgeted} /></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Geboekt 2026 (peildatum)</dt><dd>{detail.actual2026 == null ? "—" : <CurrencyText value={detail.actual2026} />}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Realisatie 2027</dt><dd className="text-muted-foreground">Nog geen realisatie opgenomen</dd></div>
              <div><dt className="text-muted-foreground">Onderbouwing</dt><dd className="mt-1">{detail.basis}</dd></div>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
