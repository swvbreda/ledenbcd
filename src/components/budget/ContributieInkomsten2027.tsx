import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export type Scenario = "full" | "half";
type Row = { label: string; count: number; amount: number };
type Staffel = { label: string; amount: number };
export type Group = { id: number; name: string; shops: number; minimum?: boolean };

const BASE = 3000;
const eur = (n: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

/** Bijdrage per lid/groep in het gekozen scenario: 50% van de verhoging boven de basisbijdrage. */
export function scenarioAmount(full: number, scenario: Scenario): number {
  return scenario === "full" ? full : BASE + (full - BASE) / 2;
}

/** Staffelindex volgens de voorgestelde staffel: 1 | 2–3 | 4–6 | 7–10 | meer dan 10 locaties. */
export function staffelIndex(shops: number): number {
  return shops <= 1 ? 0 : shops <= 3 ? 1 : shops <= 6 ? 2 : shops <= 10 ? 3 : 4;
}

/** Leidt de tabel af uit de server-snapshot; staffels zonder leden/groepen tonen 0. */
export function contributieRows(rows: readonly Row[], staffel: readonly Staffel[], scenario: Scenario, groups: readonly Group[] = []) {
  const single = rows.find((r) => r.label === staffel[0]?.label)?.count ?? 0;
  const lines = staffel.map((s, i) => {
    const count = rows.filter((r) => r.label === s.label).reduce((t, r) => t + r.count, 0);
    const members = i === 0 ? [] : groups.filter((g) => staffelIndex(g.shops) === i);
    const shops = i === 0 ? single : members.reduce((t, g) => t + g.shops, 0);
    const minimum = members.some((g) => g.minimum);
    const amount = scenarioAmount(s.amount, scenario);
    return { label: s.label, count, shops, minimum, members, amount, total: count * amount };
  });
  const count = lines.reduce((t, l) => t + l.count, 0);
  return { lines, count, single, multi: count - single, minimum: groups.some((g) => g.minimum), shops: lines.reduce((t, l) => t + l.shops, 0), total: lines.reduce((t, l) => t + l.total, 0) };
}

export default function ContributieInkomsten2027({ rows, staffel, scenario, onScenario, groups = [], peildatum, registratie }: {
  rows: readonly Row[]; staffel: readonly Staffel[]; scenario: Scenario; onScenario: (s: Scenario) => void; groups?: readonly Group[]; peildatum?: string;
  registratie?: { geregistreerd: number; uitgesloten: readonly { id: number; name: string; reden: string }[] };
}) {
  const t = contributieRows(rows, staffel, scenario, groups);
  const [open, setOpen] = useState(false);
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
      <p className="px-3 pt-2 text-sm" data-testid="contrib-summary">
        {t.minimum ? "Minimaal " : ""}<span className="font-semibold tabular-nums">{t.shops}</span> coffeeshops in deze raming, verdeeld over <span className="font-semibold tabular-nums">{t.count}</span> leden/groepen: <span className="tabular-nums">{t.single}</span> met 1 shop en <span className="tabular-nums">{t.multi}</span> groepen met meerdere shops.
      </p>
      {registratie && (
        <p className="px-3 pt-1 text-xs text-muted-foreground" data-testid="contrib-registratie">
          Aansluiting ramingsbron: {registratie.geregistreerd} registraties − {registratie.uitgesloten.length} niet afzonderlijk geraamd ({registratie.uitgesloten.map((u) => `${u.name}: ${u.reden}`).join("; ")}) = {registratie.geregistreerd - registratie.uitgesloten.length} ramingsleden/groepen. Niets verwijderd; dit is de ramingssnapshot, niet het actuele ledendashboard, en geen bevestigd aantal betalende leden.
        </p>
      )}
      <div className="overflow-x-auto overscroll-x-contain px-3 py-2">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Aantal shops per lid/groep</th>
              <th className="py-1.5 pr-2 text-right font-medium">Aantal leden/groepen</th>
              <th className="py-1.5 pr-2 text-right font-medium">Aantal coffeeshops</th>
              <th className="py-1.5 pr-2 text-right font-medium">Jaarbijdrage per lid/groep</th>
              <th className="py-1.5 text-right font-medium">Geraamde inkomsten</th>
            </tr>
          </thead>
          <tbody>
            {t.lines.map((l) => (
              <tr key={l.label} className="border-b border-border/50">
                <td className="py-1.5 pr-2">{l.label}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.count}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.minimum ? `min. ${l.shops}` : l.shops}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{eur(l.amount)}</td>
                <td className="py-1.5 text-right tabular-nums">{eur(l.total)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1.5 pr-2">Totaal ({scenario === "full" ? "volledige staffel" : "50% van de verhoging"})</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{t.count}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums" data-testid="contrib-shops">{t.minimum ? `min. ${t.shops}` : t.shops}</td>
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
                  <h4 className="mb-1 text-xs font-semibold">{l.label}: {l.members.length} {l.members.length === 1 ? "groep" : "groepen"}, {l.minimum ? "minimaal " : ""}{l.shops} shops · {eur(l.amount)} per groep</h4>
                  <ul className="divide-y divide-border/50 rounded-md border border-border/50">
                    {l.members.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 px-2 py-1">
                        <a href={`/leden/${g.id}`} className="font-medium hover:text-brand-red">{g.name}</a>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{g.minimum ? `meer dan 10 (min. ${g.shops}, exact onbekend)` : `${g.shops} shops`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Bron: ramingssnapshot{peildatum ? ` van ${peildatum}` : ""} (concept). Groepsindelingen en aantallen shops zijn deels voorlopig en niet gecontroleerd op eigendom of unieke vestigingen; zie de controlepunten (o.a. Hunters meer dan 10, exact aantal onbekend, The Plug 6 i.p.v. 7, Coffeeshop 010 met adresloze locaties, GOA/Scolo, Boere Jongens 4 volgens snapshot).</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
      <p className="px-3 pb-2 pt-1 text-xs text-muted-foreground">Een groep met meerdere shops telt hier eenmaal als lid/groep. {t.minimum ? "Minimaal " : ""}{t.shops} is het aantal coffeeshops in deze raming, geen actueel of volledig ledentotaal. Scenario niet vastgesteld; geraamd, niet ontvangen. Aannames en controlepunten staan onder Toelichting contributieraming.</p>
    </section>
  );
}
