import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, ArrowDownToLine, Pencil, Check, X, UserPlus } from "lucide-react";
import { useMemo, useState, Fragment } from "react";
import type { BudgetExpense, BudgetCategory } from "@/hooks/useBudget";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface MemberOption { id: number; naam: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lineItemName: string;
  lineItemId: string;
  categoryName?: string;
  expenses: BudgetExpense[];
  onAddExpense: (expense: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string }) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateExpense?: (id: string, fields: { line_item_id?: string; dossier?: string | null; direction?: "in" | "out" }) => void;
  onUpdateBankTransaction?: (id: string, fields: { line_item_id?: string | null; dossier?: string | null }) => void;
  onUpdatePontoTransaction?: (id: string, fields: { budget_line_item_id?: string | null; dossier?: string | null }) => void;
  onLinkPayment?: (input: { member_id: number; amount: number; paid_at: string | null }) => void;
  categories?: BudgetCategory[];
  members?: MemberOption[];
  userId: string;
}

export default function ExpenseDialog({
  open,
  onOpenChange,
  lineItemName,
  categoryName,
  expenses,
  onDeleteExpense,
  onUpdateExpense,
  onUpdateBankTransaction,
  onUpdatePontoTransaction,
  onLinkPayment,
  categories,
  members = [],
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editLineItemId, setEditLineItemId] = useState<string>("");
  const [editDossier, setEditDossier] = useState<string>("");
  const [editMemberId, setEditMemberId] = useState<string>("");

  const isIncomeCategory = useMemo(
    () => /inkomst|contribut|subsid|opbreng/i.test(categoryName || ""),
    [categoryName]
  );
  const isContributionLine = useMemo(
    () => /^contribut/i.test(lineItemName || ""),
    [lineItemName]
  );

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (a.naam || "").localeCompare(b.naam || "")),
    [members]
  );

  const dossierOptions = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      const d = (e.dossier || "").trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const startEdit = (e: BudgetExpense) => {
    setEditingId(e.id);
    setEditLineItemId(e.line_item_id);
    setEditDossier(e.dossier || "");
    setEditMemberId("");
    const cat = (categories || []).find((c) => c.line_items.some((li) => li.id === e.line_item_id));
    setEditCategoryId(cat?.id || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCategoryId("");
    setEditLineItemId("");
    setEditDossier("");
    setEditMemberId("");
  };

  const saveEdit = (e: BudgetExpense) => {
    if (!editingId) return;
    const rawId = editingId;
    const isPonto = rawId.startsWith("ponto:");
    const isBank = rawId.startsWith("bank:");
    const isContrib = rawId.startsWith("contrib:");
    const cleanId = rawId.includes(":") ? rawId.split(":")[1] : rawId;
    const dossierValue = editDossier.trim() ? editDossier.trim() : null;
    const lineItemChanged = editLineItemId && editLineItemId !== e.line_item_id;

    if (isPonto) {
      onUpdatePontoTransaction?.(cleanId, {
        ...(lineItemChanged ? { budget_line_item_id: editLineItemId } : {}),
        dossier: dossierValue,
      });
    } else if (isBank) {
      onUpdateBankTransaction?.(cleanId, {
        ...(lineItemChanged ? { line_item_id: editLineItemId } : {}),
        dossier: dossierValue,
      });
    } else if (isContrib) {
      // Contributiebetalingen worden hier niet rechtstreeks verschoven.
    } else {
      onUpdateExpense?.(cleanId, {
        ...(lineItemChanged ? { line_item_id: editLineItemId } : {}),
        dossier: dossierValue,
      });
    }
    cancelEdit();
  };

  const saveMemberLink = (e: BudgetExpense) => {
    if (!editMemberId || !onLinkPayment) return;
    onLinkPayment({
      member_id: Number(editMemberId),
      amount: Number(e.amount) || 0,
      paid_at: e.expense_date || e.paid_date || null,
    });
    cancelEdit();
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d.slice(0, 10);
    return dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const parseBankLine = (raw?: string | null): { merchant: string; note: string } => {
    if (!raw) return { merchant: "", note: "" };
    const s = raw.replace(/\s+/g, " ").trim();
    const bea = s.match(/^BEA,\s*(?:Apple Pay|Betaalpas|Google Pay)\s*(.+?)(?:,\s*PAS\d+.*)?$/i);
    if (bea?.[1]) {
      const merchant = bea[1].replace(/^[\s,*]+|[\s,]+$/g, "").replace(/\s{2,}/g, " ");
      return { merchant, note: "Pinbetaling" };
    }
    if (/^\/TRTP\//i.test(s)) {
      const field = (k: string) => {
        const m = s.match(new RegExp(`/${k}/([^/]+)`, "i"));
        return m?.[1]?.trim() || "";
      };
      const merchant = field("NAME") || field("Wero") || "iDEAL betaling";
      const note = field("REMI") || field("EREF") || "iDEAL betaling";
      return { merchant, note };
    }
    const naam = s.match(/Naam:\s*(.+?)(?:\s+(?:Omschrijving|Kenmerk|IBAN|BIC|Machtiging|Incassant):|$)/i)?.[1]?.trim();
    const omschr = s.match(/Omschrijving:\s*(.+?)(?:\s+(?:Kenmerk|IBAN|BIC|Machtiging|Incassant|Naam):|$)/i)?.[1]?.trim();
    if (naam || omschr) {
      return { merchant: naam || "", note: omschr || "" };
    }
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

  const visibleExpenses = expenses
    .filter((e) => (isIncomeCategory ? true : e.direction !== "in"))
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
            <div className="overflow-auto max-h-[500px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium whitespace-nowrap">Datum</th>
                    <th className="text-right px-2 py-1 text-muted-foreground font-medium whitespace-nowrap w-36">Bedrag</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Leverancier</th>
                    <th className="text-left px-2 py-1 text-muted-foreground font-medium">Omschrijving / factuurnr.</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {visibleExpenses.map((e) => {
                    const isBank = !!(e as unknown as { _fromBank?: boolean })._fromBank;
                    const parsed = isBank ? parseBankLine(e.description) : { merchant: "", note: e.description || "" };
                    const merchant = e.creditor_name || parsed.merchant;
                    const note = parsed.note || (isBank ? "" : e.description || "");
                    const isEditing = editingId === e.id;
                    const isContribRow = e.id.startsWith("contrib:");
                    const canEdit = !isContribRow;
                    return (
                      <Fragment key={e.id}>
                        <tr
                          className={`border-b border-border/50 ${canEdit ? "cursor-pointer hover:bg-muted/40" : ""} ${isEditing ? "bg-muted/40" : ""}`}
                          onClick={() => {
                            if (!canEdit) return;
                            if (isEditing) cancelEdit();
                            else startEdit(e);
                          }}
                        >
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
                          <td className="px-1" onClick={(ev) => ev.stopPropagation()}>
                            <div className="flex items-center gap-0.5">
                              {canEdit && !isEditing && (
                                <button
                                  onClick={() => startEdit(e)}
                                  className="p-1 text-muted-foreground hover:text-foreground"
                                  title="Bewerken"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
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
                        {isEditing && (
                          <tr className="bg-muted/20 border-b border-border">
                            <td colSpan={5} className="px-3 py-3">
                              <div className="mb-3 rounded border border-border bg-background p-3 space-y-1 text-xs">
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                  <div><span className="text-muted-foreground">Datum: </span><span className="font-medium">{fmtDate(e.expense_date) || "—"}</span></div>
                                  <div><span className="text-muted-foreground">Bedrag: </span><span className="font-medium tabular-nums">€ {(Number(e.amount) || 0).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                  {e.creditor_name && <div><span className="text-muted-foreground">Tegenpartij: </span><span className="font-medium">{e.creditor_name}</span></div>}
                                  {e.invoice_reference && <div><span className="text-muted-foreground">Referentie: </span><span className="font-medium">{e.invoice_reference}</span></div>}
                                </div>
                                {e.description && (
                                  <div>
                                    <div className="text-muted-foreground mb-0.5">Volledige omschrijving:</div>
                                    <div className="whitespace-pre-wrap break-words font-mono text-[11px] bg-muted/40 rounded p-2">{e.description}</div>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                                <div>
                                  <label className="text-[11px] font-medium text-muted-foreground">Categorie</label>
                                  <Select
                                    value={editCategoryId}
                                    onValueChange={(v) => {
                                      setEditCategoryId(v);
                                      const cat = (categories || []).find((c) => c.id === v);
                                      if (!cat?.line_items.some((li) => li.id === editLineItemId)) setEditLineItemId("");
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categorie..." /></SelectTrigger>
                                    <SelectContent>
                                      {(categories || []).map((c) => (
                                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium text-muted-foreground">Begrotingspost</label>
                                  <Select value={editLineItemId} onValueChange={setEditLineItemId} disabled={!editCategoryId}>
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Begrotingspost..." /></SelectTrigger>
                                    <SelectContent>
                                      {((categories || []).find((c) => c.id === editCategoryId)?.line_items || []).map((li) => (
                                        <SelectItem key={li.id} value={li.id} className="text-xs">{li.name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label className="text-[11px] font-medium text-muted-foreground">Dossier</label>
                                  <Select
                                    value={editDossier || "__none__"}
                                    onValueChange={(v) => setEditDossier(v === "__none__" ? "" : v)}
                                  >
                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Geen dossier" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__" className="text-xs">Geen dossier</SelectItem>
                                      {dossierOptions.map((d) => (
                                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                                      ))}
                                      {editDossier && !dossierOptions.includes(editDossier) && (
                                        <SelectItem value={editDossier} className="text-xs">{editDossier}</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" className="h-8 text-xs" onClick={() => saveEdit(e)}>
                                    <Check size={12} className="mr-1" /> Opslaan
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={cancelEdit}>
                                    <X size={12} className="mr-1" /> Annuleren
                                  </Button>
                                </div>
                              </div>

                              {isIncomeCategory && isContributionLine && onLinkPayment && (
                                <div className="mt-3 pt-3 border-t border-border/60">
                                  <div className="text-[11px] font-medium text-muted-foreground mb-1">
                                    Contributie koppelen aan lid
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                                    <div className="flex-1">
                                      <Select value={editMemberId} onValueChange={setEditMemberId}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Kies lid..." /></SelectTrigger>
                                        <SelectContent>
                                          {sortedMembers.map((m) => (
                                            <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                                              #{m.id} — {m.naam}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs"
                                      disabled={!editMemberId}
                                      onClick={() => saveMemberLink(e)}
                                    >
                                      <UserPlus size={12} className="mr-1" /> Registreer betaling
                                    </Button>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    Maakt een contributiebetaling aan voor dit lid met bovenstaand bedrag en datum.
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
            Klik op een regel om de post te wijzigen{isIncomeCategory && isContributionLine ? " of een contributiebetaling aan een lid te koppelen." : "."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}