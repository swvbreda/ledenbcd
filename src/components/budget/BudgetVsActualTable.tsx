import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";

interface Props {
  categories: BudgetCategory[];
  year: number;
  /** Canoniek uitgaventotaal uit de boekhouding; leidend voor de hoofdkaart. */
  canonicalSpent?: number;
}

export default function BudgetVsActualTable({ categories, year, canonicalSpent }: Props) {
  if (categories.length === 0) return null;

  // Only expense categories — inkomstenposten (bv. contributies, subsidies) horen
  // niet in "uitgegeven van begroot".
  const expenseCategories = categories.filter(
    (c) => !/inkomst|contribut|subsid|opbreng/i.test(c.name)
  );

  const perCat = expenseCategories
    .map((cat) => {
      const budgeted = cat.line_items.reduce((sum, li) => sum + Number(li.budgeted_amount || 0), 0);
      // Alle meetellende inkoopfacturen tellen mee (betaald én openstaand), met
      // behoud van teken (creditnota verlaagt). Aanvullende lokale mutaties
      // staan hier apart: uitgaand verhoogt, inkomend verlaagt de kosten.
      let informer = 0;
      let localOut = 0;
      let localIn = 0;
      for (const li of cat.line_items) {
        for (const e of li.expenses) {
          const amount = Number(e.amount || 0);
          if (!(e as any)._localOnly) informer += amount;
          else if (e.direction === "in") localIn += Math.abs(amount);
          else localOut += Math.abs(amount);
        }
      }
      const spent = informer + localOut - localIn;
      // Netto per categorie: overschrijding binnen een post wordt verrekend
      // met ruimte op andere posten in dezelfde categorie.
      const net = budgeted - spent;
      const available = Math.max(net, 0);
      const overrun = Math.min(net, 0);
      return { id: cat.id, name: cat.name, budgeted, spent, informer, localOut, localIn, available, overrun };
    })
    .sort((a, b) => b.spent - a.spent);

  const totalBudgeted = perCat.reduce((s, c) => s + c.budgeted, 0);
  const categoryInformer = perCat.reduce((s, c) => s + c.informer, 0);
  const totalLocalOut = perCat.reduce((s, c) => s + c.localOut, 0);
  const totalLocalIn = perCat.reduce((s, c) => s + c.localIn, 0);
  // Het boekhoudtotaal blijft exact het canonieke Informer-bedrag.
  const informerTotal = typeof canonicalSpent === "number" ? canonicalSpent : categoryInformer;
  // Managementbedrag: boekhouding plus aanvullende lokale mutaties.
  const totalSpent = informerTotal + totalLocalOut - totalLocalIn;
  // Beschikbaar = begroting − management werkelijk.
  const totalAvailable = totalBudgeted - totalSpent;

  const over = totalSpent > totalBudgeted && totalBudgeted > 0;
  const pct = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

  return (
    <div className="border border-border rounded-lg bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-semibold">Begroting vs Werkelijk — {year}</h3>
        <div className="text-xs text-muted-foreground">
          <span className="tabular-nums"><CurrencyText value={totalSpent} /></span>
          {" van "}
          <span className="tabular-nums"><CurrencyText value={totalBudgeted} /></span>
          {" begroot · beschikbaar "}
          <span className={`tabular-nums font-medium ${totalAvailable < 0 ? "text-destructive" : "text-green-600"}`}>
            <CurrencyText value={totalAvailable} />
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Informer werkelijk</dt>
          <dd className="tabular-nums font-medium"><CurrencyText value={informerTotal} /></dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Aanvullende lokale uitgaven</dt>
          <dd className="tabular-nums font-medium"><CurrencyText value={totalLocalOut} /></dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Lokale inkomsten/terugbetalingen</dt>
          <dd className="tabular-nums font-medium"><CurrencyText value={totalLocalIn} /></dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-muted-foreground">Management werkelijk</dt>
          <dd className="tabular-nums font-semibold"><CurrencyText value={totalSpent} /></dd>
        </div>
      </dl>

      <p className="text-[11px] text-muted-foreground">
        Informer werkelijk is het boekhoudtotaal en hoort bij Controle &amp; sync.
        De postregels hieronder tonen het managementbedrag: boekhouding plus
        aanvullende lokale mutaties die niet in Informer staan.
      </p>



      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${over ? "bg-destructive" : "bg-brand-red"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-2 md:hidden">
        {perCat.map((c) => {
          const catPct = c.budgeted > 0 ? Math.round((c.spent / c.budgeted) * 100) : 0;
          const catOver = c.spent > c.budgeted && c.budgeted > 0;
          return (
            <div key={c.id} className="rounded-md border border-border/70 p-3">
              <div className="mb-2 font-medium">{c.name}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Begroot</dt>
                <dd className="text-right tabular-nums"><CurrencyCell value={c.budgeted} /></dd>
                <dt className="text-muted-foreground">Uitgegeven</dt>
                <dd className="text-right tabular-nums"><CurrencyCell value={c.spent} /></dd>
                <dt className="text-muted-foreground">Verbruikt</dt>
                <dd className={`text-right tabular-nums ${catOver ? "font-medium text-destructive" : ""}`}>
                  {c.budgeted > 0 ? `${catPct}%` : "—"}
                </dd>
                <dt className="text-muted-foreground">Beschikbaar</dt>
                <dd className="text-right tabular-nums">
                  <CurrencyCell value={c.available + c.overrun} className={c.overrun < 0 ? "text-destructive" : ""} />
                </dd>
              </dl>
            </div>
          );
        })}
      </div>

      <table className="hidden w-full text-xs md:table">
        <thead>
          <tr className="text-muted-foreground border-b border-border/40">
            <th className="text-left font-medium py-1">Categorie</th>
            <th className="text-right font-medium py-1">Begroot</th>
            <th className="text-right font-medium py-1">Uitgegeven</th>
            <th className="text-right font-medium py-1 w-16">%</th>
            <th className="text-right font-medium py-1">Beschikbaar</th>
          </tr>
        </thead>
        <tbody>
          {perCat.map((c) => {
            const catPct = c.budgeted > 0 ? Math.round((c.spent / c.budgeted) * 100) : 0;
            const catOver = c.spent > c.budgeted && c.budgeted > 0;
            return (
              <tr key={c.id} className="border-b border-border/20">
                <td className="py-1">{c.name}</td>
                <td className="py-1 text-right tabular-nums"><CurrencyCell value={c.budgeted} /></td>
                <td className="py-1 text-right tabular-nums"><CurrencyCell value={c.spent} /></td>
                <td className={`py-1 text-right tabular-nums ${catOver ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {c.budgeted > 0 ? `${catPct}%` : "—"}
                </td>
                <td className="py-1 text-right tabular-nums">
                  <CurrencyCell
                    value={c.available + c.overrun}
                    className={c.overrun < 0 ? "text-destructive" : ""}
                  />
                </td>


              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
