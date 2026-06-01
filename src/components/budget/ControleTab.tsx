import { useMemo, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { Badge } from "@/components/ui/badge";
import type { BudgetCategory } from "@/hooks/useBudget";
import type { Contribution } from "@/hooks/useContributions";

interface MemberOption { id: number; naam: string }

interface BankRow {
  date: string; // ISO yyyy-mm-dd
  amount: number; // positive = bij (income), negative = af (expense)
  description: string;
  raw: string;
}

interface DashboardRow {
  id: string;
  date: string;
  amount: number; // signed: + income, - expense
  description: string;
  source: "expense" | "income";
}

interface Props {
  categories: BudgetCategory[];
  contributions: Contribution[];
  members: MemberOption[];
  year: number;
}

const fmtDate = (d: string) => {
  if (!d) return "";
  const p = d.split("-");
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d;
};

// Parse various date formats into yyyy-mm-dd
const parseDate = (s: string): string | null => {
  const trimmed = s.trim();
  if (!trimmed) return null;
  // yyyy-mm-dd or yyyy/mm/dd
  let m = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  // dd-mm-yyyy or dd/mm/yyyy
  m = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  // yyyymmdd
  m = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

// Parse amounts like "1.234,56" "1,234.56" "1234.56" "-1234,56" "1234,56-"
const parseAmount = (s: string): number | null => {
  let v = s.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!v) return null;
  let negative = false;
  if (v.endsWith("-")) { negative = true; v = v.slice(0, -1); }
  if (v.startsWith("-")) { negative = true; v = v.slice(1); }
  // If both , and . exist, the last one is decimal
  const lastComma = v.lastIndexOf(",");
  const lastDot = v.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      // EU: . thousands, , decimal
      v = v.replace(/\./g, "").replace(",", ".");
    } else {
      // US: , thousands, . decimal
      v = v.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    // assume EU decimal comma
    v = v.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(v);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
};

// Split CSV-ish line on ; , or \t
const splitLine = (line: string): string[] => {
  // very simple csv parser supporting "quoted ; values"
  const cols: string[] = [];
  let cur = "";
  let inQuote = false;
  let sep: string | null = null;
  // detect separator
  if (!sep) {
    const counts = { ";": (line.match(/;/g) || []).length, ",": (line.match(/,/g) || []).length, "\t": (line.match(/\t/g) || []).length };
    sep = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]) || ";";
  }
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      cols.push(cur); cur = "";
    } else cur += ch;
  }
  cols.push(cur);
  return cols.map((c) => c.trim());
};

const parseBankText = (text: string, defaultYear: number): { rows: BankRow[]; errors: string[] } => {
  const errors: string[] = [];
  const rows: BankRow[] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows, errors: ["Geen regels gevonden"] };

  // Detect header on first row
  const first = splitLine(lines[0]);
  let dateIdx = -1, amountIdx = -1, descIdx = -1, debitIdx = -1, creditIdx = -1, sideIdx = -1;
  const lower = first.map((c) => c.toLowerCase());
  const findIdx = (...needles: string[]) => lower.findIndex((c) => needles.some((n) => c.includes(n)));
  let headerDetected = false;
  if (parseDate(first[0]) === null) {
    headerDetected = true;
    dateIdx = findIdx("datum", "date", "boekdatum");
    descIdx = findIdx("omschrijving", "description", "naam", "tegenrekening", "mededeling", "tegenpartij");
    amountIdx = findIdx("bedrag", "amount");
    debitIdx = findIdx("debet", "af", "uitgaande");
    creditIdx = findIdx("credit", "bij", "inkomende");
    sideIdx = findIdx("af/bij", "debet/credit", "d/c", "mutatiesoort");
  }

  const startIdx = headerDetected ? 1 : 0;
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    let date: string | null = null;
    let amount: number | null = null;
    let desc = "";

    if (headerDetected) {
      date = parseDate(cols[dateIdx] || "");
      if (amountIdx >= 0) {
        amount = parseAmount(cols[amountIdx] || "");
        if (sideIdx >= 0 && amount !== null) {
          const side = (cols[sideIdx] || "").toLowerCase();
          if (side.startsWith("af") || side.startsWith("d")) amount = -Math.abs(amount);
          else if (side.startsWith("bij") || side.startsWith("c")) amount = Math.abs(amount);
        }
      } else if (debitIdx >= 0 || creditIdx >= 0) {
        const debet = debitIdx >= 0 ? parseAmount(cols[debitIdx] || "") : null;
        const credit = creditIdx >= 0 ? parseAmount(cols[creditIdx] || "") : null;
        if (debet && debet !== 0) amount = -Math.abs(debet);
        else if (credit && credit !== 0) amount = Math.abs(credit);
      }
      desc = descIdx >= 0 ? (cols[descIdx] || "") : cols.slice(2).join(" ");
    } else {
      // heuristic: find a date column and an amount column
      for (const c of cols) {
        if (!date) { const d = parseDate(c); if (d) { date = d; continue; } }
        if (amount === null) { const a = parseAmount(c); if (a !== null && Math.abs(a) > 0) { amount = a; continue; } }
      }
      desc = cols.filter((c) => parseDate(c) === null && parseAmount(c) === null).join(" ");
    }

    if (!date || amount === null) {
      errors.push(`Regel ${i + 1} overgeslagen: ${lines[i].slice(0, 80)}`);
      continue;
    }
    // restrict to selected year by default
    const y = parseInt(date.slice(0, 4), 10);
    if (y && y !== defaultYear) continue;
    rows.push({ date, amount, description: desc.trim(), raw: lines[i] });
  }
  return { rows, errors };
};

export default function ControleTab({ categories, contributions, members, year }: Props) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<{ rows: BankRow[]; errors: string[] } | null>(null);

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m.naam])), [members]);

  const dashboardRows: DashboardRow[] = useMemo(() => {
    const out: DashboardRow[] = [];
    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          if (!exp.paid_date && !exp.expense_date) continue;
          out.push({
            id: exp.id,
            date: exp.paid_date || exp.expense_date || "",
            amount: -Math.abs(exp.amount),
            description: [exp.creditor_name, exp.description, `${cat.name} → ${li.name}`].filter(Boolean).join(" — "),
            source: "expense",
          });
        }
      }
    }
    for (const c of contributions || []) {
      if (!c.paid) continue;
      out.push({
        id: c.id,
        date: c.paid_date || c.invoice_date || "",
        amount: Math.abs(c.amount),
        description: `Contributie — ${memberMap.get(c.member_id) || `Lid #${c.member_id}`}`,
        source: "income",
      });
    }
    return out;
  }, [categories, contributions, memberMap]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
    setParsed(parseBankText(t, year));
  };

  const runCompare = () => setParsed(parseBankText(text, year));

  const comparison = useMemo(() => {
    if (!parsed) return null;
    const dashUsed = new Set<string>();
    const matched: { bank: BankRow; dash: DashboardRow }[] = [];
    const missingInDashboard: BankRow[] = [];

    // tolerate 1 cent rounding
    const same = (a: number, b: number) => Math.abs(a - b) < 0.01;

    for (const b of parsed.rows) {
      const candidate = dashboardRows.find(
        (d) => !dashUsed.has(d.id) && d.date === b.date && same(d.amount, b.amount)
      );
      if (candidate) {
        dashUsed.add(candidate.id);
        matched.push({ bank: b, dash: candidate });
      } else {
        missingInDashboard.push(b);
      }
    }
    const extraInDashboard = dashboardRows.filter((d) => !dashUsed.has(d.id));

    const bankTotal = parsed.rows.reduce((s, r) => s + r.amount, 0);
    const dashTotal = dashboardRows.reduce((s, r) => s + r.amount, 0);

    return { matched, missingInDashboard, extraInDashboard, bankTotal, dashTotal };
  }, [parsed, dashboardRows]);

  return (
    <div className="mt-4 space-y-4">
      <div className="border-2 border-primary/60 rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-start gap-2">
          <FileSearch size={18} className="text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Bankupload vs. dashboard</h3>
            <p className="text-xs text-muted-foreground">
              Plak je bankafschrift (CSV) of upload het bestand. Vergelijking op datum + bedrag voor jaar {year}.
              Niets wordt opgeslagen — alleen vergeleken.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent cursor-pointer">
            <Upload size={12} /> CSV uploaden
            <Input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFile} />
          </label>
          <Button size="sm" variant="default" className="h-8 text-xs" onClick={runCompare} disabled={!text.trim()}>
            Vergelijk
          </Button>
          {text && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setText(""); setParsed(null); }}>
              Wissen
            </Button>
          )}
        </div>
        <Textarea
          placeholder={"Plak hier de inhoud van het bankafschrift (CSV met datum, bedrag, omschrijving — kolomscheiding ; of , of tab)"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="font-mono text-[11px] h-32"
        />
      </div>

      {comparison && parsed && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <StatCard label="Bankregels" value={`${parsed.rows.length}`} hint={<CurrencyText value={comparison.bankTotal} />} />
            <StatCard label="Dashboardregels" value={`${dashboardRows.length}`} hint={<CurrencyText value={comparison.dashTotal} />} />
            <StatCard label="Gematcht" value={`${comparison.matched.length}`} tone="ok" />
            <StatCard
              label="Afwijkingen"
              value={`${comparison.missingInDashboard.length + comparison.extraInDashboard.length}`}
              tone={comparison.missingInDashboard.length + comparison.extraInDashboard.length > 0 ? "warn" : "ok"}
            />
          </div>

          {parsed.errors.length > 0 && (
            <div className="border border-amber-500/40 bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 text-xs">
              <div className="font-medium text-amber-700 dark:text-amber-400 mb-1">
                {parsed.errors.length} regels niet geïnterpreteerd
              </div>
              <ul className="text-amber-700/80 dark:text-amber-400/80 list-disc pl-4 space-y-0.5 max-h-24 overflow-auto">
                {parsed.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <Section
            title="Ontbreekt in dashboard"
            subtitle="Staat wel op de bank, maar niet in het dashboard voor dit jaar."
            count={comparison.missingInDashboard.length}
            tone="warn"
          >
            <CompareTable
              rows={comparison.missingInDashboard.map((b) => ({
                date: b.date, amount: b.amount, description: b.description, side: "bank" as const,
              }))}
            />
          </Section>

          <Section
            title="Alleen in dashboard"
            subtitle="Staat in het dashboard, maar niet teruggevonden in de bankupload."
            count={comparison.extraInDashboard.length}
            tone="warn"
          >
            <CompareTable
              rows={comparison.extraInDashboard.map((d) => ({
                date: d.date, amount: d.amount, description: d.description, side: d.source === "income" ? "income" : "expense" as const,
              }))}
            />
          </Section>

          <Section
            title="Gematcht"
            subtitle="Bankregel komt exact overeen met een dashboardregel."
            count={comparison.matched.length}
            tone="ok"
            collapsedByDefault
          >
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr className="border-b border-border">
                  <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                  <th className="px-2 py-1.5 text-left font-medium">Bank — omschrijving</th>
                  <th className="px-2 py-1.5 text-left font-medium">Dashboard — omschrijving</th>
                  <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {comparison.matched.map((m, i) => (
                  <tr key={i} className="border-b border-border/40">
                    <td className="px-2 py-1 tabular-nums whitespace-nowrap">{fmtDate(m.bank.date)}</td>
                    <td className="px-2 py-1">{m.bank.description}</td>
                    <td className="px-2 py-1 text-muted-foreground">{m.dash.description}</td>
                    <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
                      <CurrencyText value={m.bank.amount} className="justify-end" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: React.ReactNode; tone?: "ok" | "warn" }) {
  const toneCls = tone === "ok" ? "border-green-600/40" : tone === "warn" ? "border-amber-500/50" : "border-border";
  return (
    <div className={`rounded-lg border-2 ${toneCls} p-3 bg-card`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {hint !== undefined && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function Section({
  title, subtitle, count, tone, children, collapsedByDefault,
}: { title: string; subtitle: string; count: number; tone: "ok" | "warn"; children: React.ReactNode; collapsedByDefault?: boolean }) {
  const [open, setOpen] = useState(!collapsedByDefault);
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  const color = tone === "ok" ? "text-green-600" : "text-amber-600";
  return (
    <div className="border-2 border-primary/60 rounded-lg overflow-hidden bg-card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 text-left"
      >
        <Icon size={16} className={color} />
        <div className="flex-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <Badge variant={tone === "ok" ? "default" : "destructive"} className={`text-[10px] ${tone === "ok" ? "bg-green-600" : ""}`}>
          {count}
        </Badge>
      </button>
      {open && count > 0 && <div className="border-t border-border overflow-auto max-h-[50vh]">{children}</div>}
    </div>
  );
}

function CompareTable({ rows }: { rows: { date: string; amount: number; description: string; side: "bank" | "expense" | "income" }[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-muted/60 sticky top-0">
        <tr className="border-b border-border">
          <th className="px-2 py-1.5 text-left font-medium w-[90px]">Datum</th>
          <th className="px-2 py-1.5 text-left font-medium w-[60px]">Bron</th>
          <th className="px-2 py-1.5 text-left font-medium">Omschrijving</th>
          <th className="px-2 py-1.5 text-right font-medium w-[120px]">Bedrag</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/40">
            <td className="px-2 py-1 tabular-nums whitespace-nowrap">{fmtDate(r.date)}</td>
            <td className="px-2 py-1">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {r.side === "bank" ? "Bank" : r.side === "income" ? "In" : "Uit"}
              </Badge>
            </td>
            <td className="px-2 py-1">{r.description}</td>
            <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">
              <CurrencyText value={r.amount} className="justify-end" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}