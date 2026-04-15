import { useMemo } from "react";
import { AlertCircle, FileText, CheckCircle2, Receipt, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Declaration {
  id: string;
  board_member_name: string;
  appointment?: string | null;
  amount: number;
  status: string;
  expense_date?: string | null;
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

export default function FinancieelTodoOverzicht({ declarations, contributions, expenses, members, year }: Props) {
  const memberMap = useMemo(() => {
    const m = new Map<number, string>();
    members.forEach((mem) => m.set(mem.id, mem.naam));
    return m;
  }, [members]);

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

  const totalTodos = pendingDeclarations.length + (missingInvoices.length > 0 ? 1 : 0) + (missingReceipts.length > 0 ? 1 : 0);

  if (totalTodos === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle2 size={48} className="mb-3 text-green-500" />
        <p className="text-lg font-medium">Alles is up-to-date!</p>
        <p className="text-sm">Er zijn geen openstaande taken voor {year}.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Pending declarations */}
      {pendingDeclarations.length > 0 && (
        <Card className="border-2 border-orange-300/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle size={18} className="text-orange-500" />
              Declaraties ter goedkeuring
              <Badge variant="secondary" className="ml-auto">{pendingDeclarations.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {pendingDeclarations.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{d.board_member_name}</span>
                    {d.appointment && <span className="text-muted-foreground ml-2">— {d.appointment}</span>}
                    {d.expense_date && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {new Date(d.expense_date).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                  </div>
                  <span className="font-medium tabular-nums">{fmt(d.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing contribution invoices */}
      {missingInvoices.length > 0 && (
        <Card className="border-2 border-blue-300/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt size={18} className="text-blue-500" />
              Contributiefacturen nog te versturen
              <Badge variant="secondary" className="ml-auto">{missingInvoices.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {missingInvoices.map((m) => (
                <div key={m.id} className="py-1.5 text-sm">
                  {m.naam}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Missing receipts / documents */}
      {missingReceipts.length > 0 && (
        <Card className="border-2 border-purple-300/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload size={18} className="text-purple-500" />
              Bestanden nog te uploaden
              <Badge variant="secondary" className="ml-auto">{missingReceipts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
              {missingReceipts.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <span className="font-medium">{e.creditor_name || e.description || "Onbekend"}</span>
                    {e.expense_date && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {new Date(e.expense_date).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                  </div>
                  <span className="font-medium tabular-nums">{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
