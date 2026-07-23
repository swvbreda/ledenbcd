import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ArrowDownToLine } from "lucide-react";
import type { BudgetExpense, BudgetCategory } from "@/hooks/useBudget";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItemName: string;
  lineItemId: string;
  expenses: BudgetExpense[];
  onAddExpense: (expense: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string }) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense?: (id: string, fields: { line_item_id?: string; dossier?: string | null; direction?: "in" | "out" }) => void;
  categories?: BudgetCategory[];
  userId: string;
}

export default function ExpenseDialog({ open, onOpenChange, lineItemName, expenses, onDeleteExpense, onUpdateExpense }: Props) {
  const fmtDate = (d?: string | null) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d.slice(0, 10);
    return dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  // Parse a raw bank description into a merchant/counterparty and a short note.
  // Handles ABN AMRO formats: BEA/Betaalpas (pin/Apple Pay), SEPA, iDEAL/TRTP.
  const parseBankLine = (raw?: string | null): { merchant: string; note: string } => {
    if (!raw) return { merchant: "", note: "" };
    const s = raw.replace(/\s+/g, " ").trim();

    // BEA pin / Apple Pay: "BEA, Apple Pay<MERCHANT>,PAS045 12-06-2026 09:12 Land: NL"
    // or "BEA, Betaalpas <MERCHANT>, PAS045 ..."
    const bea = s.match(/^BEA,\s*(?:Apple Pay|Betaalpas|Google Pay)\s*(.+?)(?:,\s*PAS\d+.*)?$/i);
    if (bea?.[1]) {
      const merchant = bea[1].replace(/^[\s,*]+|[\s,]+$/g, "").replace(/\s{2,}/g, " ");
      return { merchant, note: "Pinbetaling" };
    }

    // iDEAL / TRTP: "/TRTP/iDEAL/.../NAME/<merchant>/REMI/<omschrijving>/IBAN/..."
    if (/^\/TRTP\//i.test(s)) {
      const field = (k: string) => {
        const m = s.match(new RegExp(`/${k}/([^/]+)`, "i"));
        return m?.[1]?.trim() || "";
      };
      const merchant = field("NAME") || field("Wero") || "iDEAL betaling";
      const note = field("REMI") || field("EREF") || "iDEAL betaling";
      return { merchant, note };
    }

    // SEPA Incasso/Overboeking: extract Naam + Omschrijving
    const naam = s.match(/Naam:\s*(.+?)(?:\s+(?:Omschrijving|Kenmerk|IBAN|BIC|Machtiging|Incassant):|$)/i)?.[1]?.trim();
    const omschr = s.match(/Omschrijving:\s*(.+?)(?:\s+(?:Kenmerk|IBAN|BIC|Machtiging|Incassant|Naam):|$)/i)?.[1]?.trim();
    if (naam || omschr) {
      return { merchant: naam || "", note: omschr || "" };
    }

    // Fallback: strip clutter
    const cleaned = s
      .replace(/IBAN:\s*\S+/gi, "")
      .replace(/BIC:\s*\S+/gi, "")
      .replace(/Machtiging:\s*\S+/gi, "")
      .replace(/Incassant:\s*\S+/gi, "")
      .replace(/Kenmerk:\s*\S+/gi, "")
      .replace(/PAS\d+\s*\d{2}-\d{2}-\d{4}[^,]*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return { merchant: "", note: cleaned };
  };

  // Bijschrijvingen (direction='in') horen nooit in de uitgavenlijst, ook niet
  // als ze per ongeluk aan een begrotingspost zijn gehangen. Bankboekingen
  // (_fromBank) horen wél in het overzicht — het zijn de daadwerkelijke
  // betalingen die op deze post zijn geboekt.
  const visibleExpenses = expenses
    .filter((e) => e.direction !== "in")
    .sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || ""));
  const total = visibleExpenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Transacties – {lineItemName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {visibleExpenses.length > 0 ? (
            <div className="overflow-auto max-h-[400px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium whitespace-nowrap">Datum</th>
                    <th className="text-right px-2 py-1 text-muted-foreground font-medium whitespace-nowrap w-36">Bedrag</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Leverancier</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Omschrijving / factuurnr.</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {visibleExpenses.map((e) => {
                    const isBank = !!(e as any)._fromBank;
                    const parsed = isBank ? parseBankLine(e.description) : { merchant: "", note: e.description || "" };
                    const merchant = e.creditor_name || parsed.merchant;
                    const note = parsed.note || (isBank ? "" : e.description || "");
                    return (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="px-2 py-1 whitespace-nowrap align-top">
                        {fmtDate(e.expense_date)}
                        {isBank && (
                          <div className="mt-1 inline-block text-[10px] uppercase tracking-wide bg-primary/10 text-primary rounded px-1 py-0.5">Bank</div>
                        )}
                      </td>
                      <td className="text-right px-2 py-1 whitespace-nowrap font-medium tabular-nums"><CurrencyCell value={e.amount} /></td>
                      <td className="px-2 py-1 max-w-[200px]">
                        <div className="truncate" title={merchant}>{merchant || "—"}</div>
                      </td>
                      <td className="px-2 py-1 align-top max-w-[320px]">
                        <div className="truncate font-medium" title={note}>
                          {note || merchant || "—"}
                        </div>
                        {e.invoice_reference && (
                          <div className="text-[11px] text-muted-foreground truncate" title={e.invoice_reference}>Factuur: {e.invoice_reference}</div>
                        )}
                      </td>
                      <td className="px-1">
                        <div className="flex items-center gap-0.5">
                          {onUpdateExpense && !isBank && (
                            <button
                              onClick={() => {
                                if (confirm("Markeren als bijschrijving? De regel verdwijnt dan uit de uitgavenlijst.")) {
                                  onUpdateExpense(e.id, { direction: "in" });
                                }
                              }}
                              className="p-1 text-muted-foreground hover:text-green-600"
                              title="Markeer als bijschrijving (geen uitgave)"
                            >
                              <ArrowDownToLine size={12} />
                            </button>
                          )}
                          {!isBank && (
                            <button onClick={() => onDeleteExpense(e.id)} className="p-1 text-muted-foreground hover:text-destructive" title="Verwijderen">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                  <tr className="font-medium bg-muted/30">
                    <td className="px-2 py-1">Totaal</td>
                    <td className="text-right px-2 py-1 whitespace-nowrap tabular-nums"><CurrencyCell value={total} /></td>
                    <td colSpan={3} />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen transacties geregistreerd.</p>
          )}

          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Transacties worden automatisch overgenomen uit de bankboekingen. Handmatig toevoegen is niet meer nodig.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
