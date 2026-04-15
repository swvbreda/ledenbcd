import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Receipt, Upload, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Declaration {
  id: string;
  board_member_name: string;
  appointment?: string | null;
  amount: number;
  status: string;
  expense_date?: string | null;
  created_at?: string;
}

interface Contribution {
  member_id: number;
  paid: boolean;
  amount: number;
  invoice_number?: string | null;
  invoice_file_path?: string | null;
}

interface Expense {
  id: string;
  description?: string | null;
  creditor_name?: string | null;
  amount: number;
  paid: boolean;
  pdf_file_path?: string | null;
  expense_date?: string | null;
}

interface MemberBasic {
  id: number;
  naam: string;
}

interface Props {
  declarations: Declaration[];
  contributions: Contribution[];
  expenses: Expense[];
  members: MemberBasic[];
  year: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
};

export default function FinancieelTodoOverzicht({ declarations, contributions, expenses, members, year }: Props) {
  const pendingDeclarations = useMemo(
    () => declarations.filter((d) => d.status === "pending"),
    [declarations]
  );

  const missingInvoices = useMemo(() => {
    const contribMap = new Map<number, Contribution>();
    contributions.forEach((c) => contribMap.set(c.member_id, c));
    return members
      .filter((m) => {
        const c = contribMap.get(m.id);
        return !c || (!c.invoice_number && !c.invoice_file_path);
      })
      .map((m) => ({ id: m.id, naam: m.naam }));
  }, [contributions, members]);

  const missingReceipts = useMemo(
    () => expenses.filter((e) => !e.pdf_file_path && e.amount > 0),
    [expenses]
  );

  const totalTodos = pendingDeclarations.length + missingInvoices.length + missingReceipts.length;

  if (totalTodos === 0) {
    return (
      <div className="flex items-center gap-3 py-4 px-4 rounded-lg border border-border bg-muted/30 mb-4">
        <CheckCircle2 size={20} className="text-green-600 shrink-0" />
        <p className="text-sm text-muted-foreground">Alles is up-to-date voor {year}. Geen openstaande taken.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 border-2 border-primary/60 rounded-lg overflow-hidden">
      <div className="bg-primary/5 px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Clock size={16} className="text-primary" />
        <h2 className="text-sm font-semibold">Openstaande taken ({totalTodos})</h2>
      </div>

      <div className="divide-y divide-border">
        {/* Pending declarations — actie: penningmeester moet goedkeuren */}
        {pendingDeclarations.map((d) => (
          <div key={`decl-${d.id}`} className="px-4 py-2.5 flex items-start gap-3">
            <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">Declaratie goedkeuren</span>
                <span className="text-muted-foreground"> — </span>
                <span>{d.board_member_name}</span>
                {d.appointment && <span className="text-muted-foreground"> ({d.appointment})</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtDate(d.expense_date) && <>Datum: {fmtDate(d.expense_date)} · </>}
                Bedrag: {fmt(d.amount)} · Actie: Penningmeester
              </p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">Goedkeuren</Badge>
          </div>
        ))}

        {/* Missing invoices — actie: penningmeester moet factuur versturen */}
        {missingInvoices.length > 0 && (
          <div className="px-4 py-2.5 flex items-start gap-3">
            <Receipt size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">Contributiefacturen versturen</span>
                <span className="text-muted-foreground"> — {missingInvoices.length} leden hebben nog geen factuur voor {year}</span>
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {missingInvoices.slice(0, 10).map((m) => (
                  <Badge key={m.id} variant="outline" className="text-xs font-normal">{m.naam}</Badge>
                ))}
                {missingInvoices.length > 10 && (
                  <Badge variant="outline" className="text-xs font-normal">+{missingInvoices.length - 10} meer</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Actie: Penningmeester · Tab: Contributie</p>
            </div>
          </div>
        )}

        {/* Missing receipts — actie: bestuurslid moet bestand uploaden */}
        {missingReceipts.map((e) => (
          <div key={`receipt-${e.id}`} className="px-4 py-2.5 flex items-start gap-3">
            <Upload size={16} className="text-purple-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-medium">Bestand uploaden</span>
                <span className="text-muted-foreground"> — </span>
                <span>{e.creditor_name || e.description || "Onbekende uitgave"}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {fmtDate(e.expense_date) && <>Datum: {fmtDate(e.expense_date)} · </>}
                Bedrag: {fmt(e.amount)} · Actie: Factuur/bon uploaden
              </p>
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">Upload</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
