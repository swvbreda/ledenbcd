import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Row = { label: string; count: number; amount: number };
type Staffel = { label: string; amount: number };
export type Group = { id: number; name: string; shops: number; minimum?: boolean };

const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export type Aansluiting = { start: { label: string; aantal: number }; stappen: readonly { label: string; delta: number }[]; tussenstappen: readonly { naStap: number; label: string }[]; kerngegevensNoot: string };

/** Rekenbrug: lopend totaal per stap en eindtotaal. */
export function aansluitingTotalen(a: Aansluiting) {
  let lopend = a.start.aantal;
  const stappen = a.stappen.map((s) => ({ ...s, totaal: (lopend += s.delta) }));
  return { stappen, eind: lopend };
}

/** Staffelindex volgens de voorgestelde staffel: 1 | 2–3 | 4–6 | 7–10 | meer dan 10 locaties. */
export function staffelIndex(shops: number): number {
  return shops <= 1 ? 0 : shops <= 3 ? 1 : shops <= 6 ? 2 : shops <= 10 ? 3 : 4;
}

/** Leidt de tabel af uit de server-snapshot; staffels zonder leden/groepen tonen 0. */
export function contributieRows(rows: readonly Row[], staffel: readonly Staffel[], groups: readonly Group[] = []) {
  const single = rows.find((r) => r.label === staffel[0]?.label)?.count ?? 0;
  const lines = staffel.map((s, i) => {
    const count = rows.filter((r) => r.label === s.label).reduce((t, r) => t + r.count, 0);
    const members = i === 0 ? [] : groups.filter((g) => staffelIndex(g.shops) === i);
    const shops = i === 0 ? single : members.reduce((t, g) => t + g.shops, 0);
    const minimum = members.some((g) => g.minimum);
    const amount = s.amount;
    return { label: s.label, count, shops, minimum, members, amount, total: count * amount };
  });
  const count = lines.reduce((t, l) => t + l.count, 0);
  return { lines, count, single, multi: count - single, minimum: groups.some((g) => g.minimum), shops: lines.reduce((t, l) => t + l.shops, 0), total: lines.reduce((t, l) => t + l.total, 0) };
}

export default function ContributieInkomsten2027({ rows, staffel, groups = [] }: {
  rows: readonly Row[]; staffel: readonly Staffel[]; groups?: readonly Group[];
}) {
  const t = contributieRows(rows, staffel, groups);
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="contrib-2027" className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-2 bg-muted/50 px-3 py-2">
        <h3 id="contrib-2027" className="text-sm font-semibold">Contributieraming 2027</h3>
        <p className="text-sm text-muted-foreground tabular-nums" data-testid="contrib-summary">{t.count} leden/groepen · {t.shops} coffeeshops</p>
      </div>
      <div className="overflow-x-auto overscroll-x-contain px-3 py-2">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Staffel</th>
              <th className="py-1.5 pr-2 text-right font-medium">Leden/groepen</th>
              <th className="py-1.5 pr-2 text-right font-medium">Coffeeshops</th>
              <th className="py-1.5 pr-2 text-right font-medium">Jaartarief</th>
              <th className="py-1.5 text-right font-medium">Inkomsten</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr key={l.label} className="border-b border-border/50">
                <td className="py-1.5 pr-2">{l.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.count}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.shops}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{eur(l.amount)}</td>
                <td className="py-1.5 text-right tabular-nums">{eur(l.total)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-2">Totaal</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{t.count}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums" data-testid="contrib-shops">{t.shops}</td>
              <td />
              <td className="py-1.5 text-right tabular-nums" data-testid="contrib-total">{eur(t.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {groups.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border/50">
          <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium">
            Welke leden hebben meerdere shops?
            <ChevronDown className={`h-4 w-4 text-brand-red transition-transform ${open ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3 px-3 pb-3 text-sm">
              {t.lines.slice(1).filter((l) => l.members.length > 0).map((l) => (
                <div key={l.label}>
                  <h4 className="mb-1 text-xs font-semibold">{l.label}: {l.members.length} {l.members.length === 1 ? "groep" : "groepen"}, {l.shops} shops · {eur(l.amount)} per groep</h4>
                  <ul className="divide-y divide-border/50 rounded-md border border-border/50">
                    {l.members.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 px-2 py-1">
                        <a href={`/leden/${g.id}`} className="font-medium hover:text-brand-red">{g.name}</a>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{g.shops} shops</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">Tyson nog niet meegerekend; contributiebedrag volgt.</p>
    </section>
  );
}
