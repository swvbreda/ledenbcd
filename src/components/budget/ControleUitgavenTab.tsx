import { useMemo } from "react";
import { AlertTriangle, FileWarning, Copy, FolderOpen } from "lucide-react";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import {
  useDossierMutations,
  useExpenseDocuments,
  isUnassigned,
  type DossierMutation,
} from "@/hooks/useDossiers";
import { isContributionDossier, isExcludedDossier } from "@/lib/budgetExclusions";
import { isSamePayment } from "@/lib/ledgerDedupe";

interface Props {
  year: number;
}

const formatDate = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const asLedger = (m: DossierMutation) => ({
  date: m.date,
  amount: m.amount,
  counterparty: m.counterparty,
  description: m.description,
  invoice: m.invoice,
  direction: m.direction,
});

function Section({
  title,
  icon,
  description,
  count,
  total,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  count: number;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">
              {title} <span className="text-muted-foreground">({count})</span>
            </h3>
            <p className="truncate text-[11px] text-muted-foreground">{description}</p>
          </div>
        </div>
        {typeof total === "number" && (
          <span className="whitespace-nowrap text-xs font-medium tabular-nums">
            <CurrencyText value={total} />
          </span>
        )}
      </div>
      {count === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Niets te controleren — alles in orde.</p>
      ) : (
        children
      )}
    </div>
  );
}

export default function ControleUitgavenTab({ year }: Props) {
  const { data: mutations = [], isLoading } = useDossierMutations(year);
  const { data: documents = [] } = useExpenseDocuments();

  const docKeys = useMemo(() => new Set(documents.map((d) => d.entry_key)), [documents]);
  const docDossiers = useMemo(
    () => new Set(documents.map((d) => (d.dossier || "").trim()).filter(Boolean)),
    [documents],
  );

  /** Uitgaande betalingen zonder dossier (contributies en buiten-begroting uitgezonderd). */
  const zonderDossier = useMemo(
    () =>
      mutations.filter(
        (m) => m.direction === "out" && isUnassigned(m) && !isExcludedDossier(m.dossier),
      ),
    [mutations],
  );

  /** Betalingen mét dossier maar zonder gekoppelde factuur. */
  const zonderFactuur = useMemo(
    () =>
      mutations.filter((m) => {
        if (m.direction !== "out") return false;
        if (isUnassigned(m)) return false;
        if (isContributionDossier(m.dossier) || isExcludedDossier(m.dossier)) return false;
        if (docKeys.has(m.key)) return false;
        if (docKeys.has(`dossier:${m.dossier}`) || docDossiers.has(m.dossier)) return false;
        return true;
      }),
    [mutations, docKeys, docDossiers],
  );

  /** Mogelijke dubbelingen: dezelfde betaling uit twee bronnen. */
  const dubbelingen = useMemo(() => {
    const pairs: { a: DossierMutation; b: DossierMutation }[] = [];
    for (let i = 0; i < mutations.length; i++) {
      for (let j = i + 1; j < mutations.length; j++) {
        const a = mutations[i];
        const b = mutations[j];
        if (a.kind === b.kind) continue;
        if (isContributionDossier(a.dossier) || isContributionDossier(b.dossier)) continue;
        if (isSamePayment(asLedger(a), asLedger(b))) pairs.push({ a, b });
      }
    }
    return pairs;
  }, [mutations]);

  const sum = (rows: DossierMutation[]) => rows.reduce((s, r) => s + r.amount, 0);

  if (isLoading) return <p className="py-8 text-center text-sm text-muted-foreground">Laden…</p>;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-xs text-muted-foreground">
        Controle op de uitgaven van {year}. De oude PDF-bankimport telt niet meer mee; de live bankkoppeling is
        leidend en boekingen uit Informer worden aan de bijbehorende bankbetaling gekoppeld.
      </p>

      <Section
        title="Betalingen zonder dossier"
        icon={<FolderOpen className="h-4 w-4 text-brand-red" />}
        description="Uitgaande betalingen die nog aan geen enkel dossier hangen."
        count={zonderDossier.length}
        total={sum(zonderDossier)}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="w-[12%] px-3 py-1 text-left font-medium">Datum</th>
              <th className="w-[24%] px-3 py-1 text-left font-medium">Tegenpartij</th>
              <th className="px-3 py-1 text-left font-medium">Omschrijving</th>
              <th className="w-[12%] px-3 py-1 text-right font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {zonderDossier.map((m) => (
              <tr key={m.key} className="border-b border-border/30">
                <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatDate(m.date)}</td>
                <td className="px-3 py-1">{m.counterparty || "—"}</td>
                <td className="max-w-0 truncate px-3 py-1 text-muted-foreground">{m.description}</td>
                <td className="px-3 py-1 text-right">
                  <CurrencyCell value={-m.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="Betalingen zonder factuur"
        icon={<FileWarning className="h-4 w-4 text-brand-red" />}
        description="Wel in een dossier, maar er hangt nog geen factuur of bon aan."
        count={zonderFactuur.length}
        total={sum(zonderFactuur)}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="w-[12%] px-3 py-1 text-left font-medium">Datum</th>
              <th className="w-[20%] px-3 py-1 text-left font-medium">Dossier</th>
              <th className="w-[22%] px-3 py-1 text-left font-medium">Tegenpartij</th>
              <th className="px-3 py-1 text-left font-medium">Omschrijving</th>
              <th className="w-[12%] px-3 py-1 text-right font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {zonderFactuur.map((m) => (
              <tr key={m.key} className="border-b border-border/30">
                <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatDate(m.date)}</td>
                <td className="px-3 py-1">{m.dossier || m.splits.map((s) => s.dossier).join(", ")}</td>
                <td className="px-3 py-1">{m.counterparty || "—"}</td>
                <td className="max-w-0 truncate px-3 py-1 text-muted-foreground">{m.description}</td>
                <td className="px-3 py-1 text-right">
                  <CurrencyCell value={-m.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section
        title="Vermoedelijke dubbelingen"
        icon={<Copy className="h-4 w-4 text-amber-600" />}
        description="Dezelfde betaling staat zowel als bankboeking als via Informer/handmatig in het systeem. Deze worden in de dossiers als één regel geteld."
        count={dubbelingen.length}
      >
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 bg-muted/20">
              <th className="w-[12%] px-3 py-1 text-left font-medium">Datum</th>
              <th className="w-[24%] px-3 py-1 text-left font-medium">Tegenpartij</th>
              <th className="px-3 py-1 text-left font-medium">Bronnen</th>
              <th className="w-[12%] px-3 py-1 text-right font-medium">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {dubbelingen.map(({ a, b }) => (
              <tr key={`${a.key}|${b.key}`} className="border-b border-border/30">
                <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatDate(a.date)}</td>
                <td className="px-3 py-1">{a.counterparty || b.counterparty || "—"}</td>
                <td className="px-3 py-1 text-muted-foreground">
                  {a.kind === "ponto" ? "Bank" : "Informer/handmatig"} + {b.kind === "ponto" ? "Bank" : "Informer/handmatig"}
                  {a.dossier || b.dossier ? ` · ${a.dossier || b.dossier}` : " · geen dossier"}
                </td>
                <td className="px-3 py-1 text-right">
                  <CurrencyCell value={a.direction === "in" ? a.amount : -a.amount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {dubbelingen.length > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          Dubbelingen worden automatisch samengevoegd in de begroting en de dossiers; ze tellen dus niet dubbel mee.
        </p>
      )}
    </div>
  );
}
