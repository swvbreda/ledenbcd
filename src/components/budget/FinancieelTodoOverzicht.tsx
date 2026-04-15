import { useMemo } from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Declaration {
  id: string;
  board_member_name: string;
  appointment?: string | null;
  amount: number;
  status: string;
  expense_date?: string | null;
}

interface Props {
  declarations: Declaration[];
  year: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
};

export default function FinancieelTodoOverzicht({ declarations, year }: Props) {
  const pendingDeclarations = useMemo(
    () => declarations.filter((d) => d.status === "pending"),
    [declarations]
  );

  const totalTodos = pendingDeclarations.length;

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
      </div>
    </div>
  );
}
