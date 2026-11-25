import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

/** Leden/groepen per staffel uit de volledige ledenlijst (incl. 1 locatie). */
export function ledenPerStaffel(leden: readonly Group[], staffelCount: number) {
  return Array.from({ length: staffelCount }, (_, i) => leden.filter((g) => staffelIndex(g.shops) === i).sort((x, y) => x.name.localeCompare(y.name, "nl")));
}

export default function ContributieInkomsten2027({ rows, staffel, groups = [], leden }: {
  rows: readonly Row[]; staffel: readonly Staffel[]; groups?: readonly Group[]; leden?: readonly Group[];
}) {
  const t = contributieRows(rows, staffel, groups);
  const perStaffel = leden ? ledenPerStaffel(leden, staffel.length) : t.lines.map((l) => l.members);
  const [sel, setSel] = useState<number | null>(null);
  const line = sel == null ? null : t.lines[sel];
  const members = sel == null ? [] : perStaffel[sel] ?? [];
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
            {t.lines.map((l, i) => {
              const clickable = (perStaffel[i]?.length ?? 0) > 0;
              const open = () => clickable && setSel(i);
              return (
                <tr
                  key={l.label}
                  className={`border-b border-border/50 ${clickable ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary" : "text-muted-foreground"}`}
                  tabIndex={clickable ? 0 : -1}
                  role="button"
                  aria-disabled={!clickable}
                  aria-label={clickable ? `${l.label}: toon ${l.count} leden/groepen` : `${l.label}: geen leden/groepen`}
                  onClick={open}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
                >
                  <td className="py-1.5 pr-2"><span className="inline-flex items-center gap-1">{l.label}{clickable && <ChevronRight className="h-3.5 w-3.5 text-brand-red" aria-hidden />}</span></td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{l.count}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{l.shops}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{eur(l.amount)}</td>
                  <td className="py-1.5 text-right tabular-nums">{eur(l.total)}</td>
                </tr>
              );
            })}
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
      <Dialog open={sel != null} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-lg flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{line?.label}</DialogTitle>
            <DialogDescription data-testid="staffel-dialog-summary">
              {members.length} {members.length === 1 ? "lid/groep" : "leden/groepen"} · {members.reduce((s, g) => s + g.shops, 0)} coffeeshops · {line ? eur(line.amount) : ""} per lid/groep
            </DialogDescription>
          </DialogHeader>
          <ul className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto overflow-x-hidden rounded-md border border-border/50 text-sm" data-testid="staffel-dialog-list">
            {members.map((g) => (
              <li key={g.id} className="flex items-start justify-between gap-2 px-2 py-1.5">
                <a href={`/leden/${g.id}`} className="min-w-0 break-words font-medium hover:text-brand-red">{g.name}</a>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{g.shops} {g.shops === 1 ? "shop" : "shops"} · {line ? eur(line.amount) : ""}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
