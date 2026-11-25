export type Scenario = "full" | "half";
type Row = { label: string; count: number; amount: number };
type Staffel = { label: string; amount: number };

const BASE = 3000;
const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Bijdrage per lid/groep in het gekozen scenario: 50% van de verhoging boven de basisbijdrage. */
export function scenarioAmount(full: number, scenario: Scenario): number {
  return scenario === "full" ? full : BASE + (full - BASE) / 2;
}

/** Leidt de tabel af uit de server-snapshot; staffels zonder leden/groepen tonen 0. */
export function contributieRows(rows: readonly Row[], staffel: readonly Staffel[], scenario: Scenario) {
  const lines = staffel.map((s) => {
    const count = rows.filter((r) => r.label === s.label).reduce((t, r) => t + r.count, 0);
    const amount = scenarioAmount(s.amount, scenario);
    return { label: s.label, count, amount, total: count * amount };
  });
  const single = lines[0]?.count ?? 0;
  const count = lines.reduce((t, l) => t + l.count, 0);
  return { lines, count, single, multi: count - single, total: lines.reduce((t, l) => t + l.total, 0) };
}

export default function ContributieInkomsten2027({ rows, staffel, scenario, onScenario }: {
  rows: readonly Row[]; staffel: readonly Staffel[]; scenario: Scenario; onScenario: (s: Scenario) => void;
}) {
  const t = contributieRows(rows, staffel, scenario);
  return (
    <section aria-labelledby="contrib-2027" className="overflow-hidden rounded-lg border border-border">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 px-3 py-2">
        <h3 id="contrib-2027" className="text-sm font-semibold">Contributie-inkomsten 2027 <span className="font-normal text-muted-foreground">(concept, prognose)</span></h3>
        <div role="radiogroup" aria-label="Contributiescenario" className="flex flex-wrap gap-1">
          {([["full", "Volledige staffel"], ["half", "50% van de verhoging"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={scenario === k} onClick={() => onScenario(k)}
              className={`rounded-sm px-2 py-1 text-xs font-medium ${scenario === k ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:text-foreground"}`}>{label}</button>
          ))}
        </div>
      </div>
      <p className="px-3 pt-2 text-sm">
        <span className="font-semibold tabular-nums">{t.count}</span> leden/groepen in de raming, waarvan <span className="tabular-nums">{t.single}</span> met 1 shop en <span className="tabular-nums">{t.multi}</span> groepen met meerdere shops.
      </p>
      <div className="overflow-x-auto overscroll-x-contain px-3 py-2">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Aantal shops per lid/groep</th>
              <th className="py-1.5 pr-2 text-right font-medium">Aantal leden/groepen</th>
              <th className="py-1.5 pr-2 text-right font-medium">Jaarbijdrage per lid/groep</th>
              <th className="py-1.5 text-right font-medium">Geraamde inkomsten</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr key={l.label} className="border-b border-border/50">
                <td className="py-1.5 pr-2">{l.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.count}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{eur(l.amount)}</td>
                <td className="py-1.5 text-right tabular-nums">{eur(l.total)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-2">Totaal ({scenario === "full" ? "volledige staffel" : "50% van de verhoging"})</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{t.count}</td>
              <td />
              <td className="py-1.5 text-right tabular-nums" data-testid="contrib-total">{eur(t.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-3 pb-2 text-xs text-muted-foreground">Een groep met meerdere shops telt hier eenmaal; dit is geen totaal van alle vestigingen. Scenario niet vastgesteld; geraamd, niet ontvangen. Aannames en controlepunten staan onder Toelichting contributieraming.</p>
    </section>
  );
}
