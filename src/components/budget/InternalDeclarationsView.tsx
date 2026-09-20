import { useMemo, useState } from "react";
import { Check, Download, FileText, MapPin, Plus, Receipt, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_KM_RATE, calculateTravelDeclaration } from "@/lib/declarations";
import type { DeclarationBoardMember, InternalDeclaration } from "@/hooks/useInternalDeclarations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";
import { toast } from "sonner";

type AddDeclarationInput = {
  declaration: Omit<InternalDeclaration, "id" | "reviewed_by" | "reviewed_at">;
  receipt?: File | null;
};

type AddDeclarationResult = { id: string; informerSynced: boolean } | void;

interface Props {
  declarations: InternalDeclaration[];
  boardMembers: DeclarationBoardMember[];
  year: number;
  isAdmin: boolean;
  userId: string;
  onAdd: (input: AddDeclarationInput) => Promise<AddDeclarationResult> | AddDeclarationResult;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const fmtDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("nl-NL").format(new Date(`${value}T12:00:00`))
  : "–";

const money = (value: number) => new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
}).format(value);

const statusBadge = (status: string) => {
  if (status === "approved") return <Badge className="bg-green-600">Goedgekeurd</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Afgewezen</Badge>;
  return <Badge variant="secondary">In afwachting</Badge>;
};

const informerBadge = (declaration: InternalDeclaration) => {
  if (declaration.informer_status === "synced") return <Badge className="bg-green-600">In Informer</Badge>;
  if (declaration.informer_status === "error") {
    return <Badge variant="destructive" title={declaration.informer_error || undefined}>Informer: actie nodig</Badge>;
  }
  if (declaration.informer_status === "queued") return <Badge variant="outline">Naar Informer…</Badge>;
  return null;
};

const memberAddress = (member?: DeclarationBoardMember) => [
  member?.prive_adres,
  [member?.prive_postcode, member?.prive_plaats].filter(Boolean).join(" "),
].filter(Boolean).join(", ");

export default function InternalDeclarationsView({
  declarations, boardMembers, year, isAdmin, userId, onAdd, onDelete, onApprove, onReject,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [memberId, setMemberId] = useState("");
  const [kind, setKind] = useState<"reiskosten" | "overig">("reiskosten");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [returnTrip, setReturnTrip] = useState(true);
  const [oneWayKm, setOneWayKm] = useState<number | null>(null);
  const [otherAmount, setOtherAmount] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);

  const selectedMember = boardMembers.find((member) => member.id === memberId);
  const calculation = oneWayKm == null ? null : calculateTravelDeclaration(oneWayKm, returnTrip, DEFAULT_KM_RATE);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return declarations
      .filter((item) => statusFilter === "all" || item.status === statusFilter)
      .filter((item) => !needle || [item.board_member_name, item.appointment, item.trajectory, item.declaration_type]
        .some((value) => (value || "").toLowerCase().includes(needle)))
      .sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || ""));
  }, [declarations, search, statusFilter]);

  const total = filtered.reduce((sum, item) => sum + item.amount, 0);

  const chooseMember = (id: string) => {
    setMemberId(id);
    const member = boardMembers.find((item) => item.id === id);
    setOrigin(memberAddress(member));
    setAccountHolder(member?.naam || "");
    setOneWayKm(null);
  };

  const calculateRoute = async () => {
    if (!origin.trim() || !destination.trim()) {
      toast.error("Vul eerst het vertrek- en bestemmingsadres in");
      return;
    }
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-route", {
        body: { origin: origin.trim(), destination: destination.trim() },
      });
      if (error) throw error;
      if (!data?.one_way_km) throw new Error(data?.error || "De afstand kon niet worden berekend");
      setOneWayKm(Number(data.one_way_km));
      toast.success(`Afstand berekend: ${Number(data.one_way_km).toLocaleString("nl-NL")} km enkele reis`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "De afstand kon niet worden berekend");
    } finally {
      setCalculating(false);
    }
  };

  const resetForm = () => {
    setDescription(""); setDestination(""); setOneWayKm(null); setOtherAmount(""); setReceipt(null);
    setExpenseDate(new Date().toISOString().slice(0, 10));
  };

  const submit = async () => {
    const validationError = !selectedMember ? "Selecteer eerst het bestuurslid"
      : !expenseDate ? "Kies de datum van de kosten"
      : !description.trim() ? "Vul een korte omschrijving in"
      : !bankAccount.trim() ? "Vul het rekeningnummer in"
      : !accountHolder.trim() ? "Vul de rekeninghouder in"
      : kind === "reiskosten" && !calculation ? "Bereken eerst de afstand"
      : kind === "overig" && (!otherAmount || Number(otherAmount) <= 0) ? "Vul het bedrag in"
      : kind === "overig" && !receipt ? "Voeg een foto of PDF van de bon toe"
      : null;
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);
    try {
      const result = await onAdd({
        declaration: {
          year, board_member_id: selectedMember!.id, board_member_name: selectedMember!.naam,
          declaration_type: kind, appointment: description.trim(),
          trajectory: kind === "reiskosten" ? `${origin.trim()} – ${destination.trim()}` : null,
          km_single: kind === "reiskosten" ? calculation!.oneWayKm : null,
          km_return: kind === "reiskosten" ? calculation!.totalKm : null,
          km_rate: DEFAULT_KM_RATE,
          amount: kind === "reiskosten" ? calculation!.amount : Number(otherAmount),
          expense_date: expenseDate, bank_account: bankAccount.trim(), account_holder: accountHolder.trim(),
          max_allowance_note: null, status: "pending", submitted_by: userId,
          paid_at: null, bank_transaction_id: null, receipt_path: null, informer_status: "queued",
          informer_external_id: null, informer_error: null, informer_synced_at: null,
        }, receipt,
      });
      if (result && !result.informerSynced) {
        toast.warning("Declaratie is opgeslagen. Informer vraagt nog aandacht; er is een financieel actiepunt aangemaakt.");
      } else {
        toast.success("Declaratie ingediend en als open post naar Informer gestuurd");
      }
      resetForm(); setAdding(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Declaratie kon niet worden ingediend");
    } finally { setSaving(false); }
  };

  const viewReceipt = async (path: string) => {
    const { data, error } = await supabase.storage.from("declaration-receipts").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("De bon kon niet worden geopend");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const handleExport = () => {
    const rows = filtered.map((item) => [item.expense_date || "", item.board_member_name, item.declaration_type,
      item.appointment || "", item.trajectory || "", item.km_return || "", item.amount, item.status, item.informer_status]);
    const csv = [["Datum", "Bestuurslid", "Soort", "Omschrijving", "Traject", "Km totaal", "Bedrag", "Status", "Informer"], ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `declaraties-${year}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek in declaraties…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Alle statussen</SelectItem><SelectItem value="pending">In afwachting</SelectItem><SelectItem value="approved">Goedgekeurd</SelectItem><SelectItem value="rejected">Afgewezen</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button onClick={() => setAdding((value) => !value)}><Plus className="mr-2 h-4 w-4" />Declaratie indienen</Button>
      </div>

      {adding && (
        <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-5"><h2 className="text-lg font-semibold">Nieuwe declaratie</h2><p className="text-sm text-muted-foreground">Kies eerst voor welk bestuurslid de kosten zijn gemaakt.</p></div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="min-w-0 space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Bestuurslid</span>
              <Select value={memberId} onValueChange={chooseMember}><SelectTrigger><SelectValue placeholder="Selecteer een bestuurslid" /></SelectTrigger><SelectContent>{boardMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.naam}{member.functie ? ` — ${member.functie}` : ""}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Soort declaratie</span>
              <Select value={kind} onValueChange={(value: "reiskosten" | "overig") => { setKind(value); setOneWayKm(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reiskosten">Reiskosten</SelectItem><SelectItem value="overig">Overige kosten</SelectItem></SelectContent></Select>
            </label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Datum</span><Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></label>
            <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Omschrijving</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "reiskosten" ? "Bijvoorbeeld: bestuursvergadering Utrecht" : "Waarvoor waren de kosten?"} /></label>

            {kind === "reiskosten" ? <>
              <label className="space-y-1.5"><span className="text-sm font-medium">Van</span><Input value={origin} onChange={(e) => { setOrigin(e.target.value); setOneWayKm(null); }} placeholder="Vertrekadres" /></label>
              <label className="space-y-1.5"><span className="text-sm font-medium">Naar</span><Input value={destination} onChange={(e) => { setDestination(e.target.value); setOneWayKm(null); }} placeholder="Bestemmingsadres" /></label>
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={returnTrip} onCheckedChange={(checked) => setReturnTrip(checked === true)} />Heen en terug</label>
                <Button type="button" variant="outline" onClick={calculateRoute} disabled={calculating}><MapPin className="mr-2 h-4 w-4" />{calculating ? "Afstand berekenen…" : "Bereken afstand"}</Button>
              </div>
              {calculation && <div className="grid grid-cols-2 gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950 md:col-span-2 sm:grid-cols-3">
                <div><span className="block text-xs text-green-700">Enkele reis</span><strong>{calculation.oneWayKm.toLocaleString("nl-NL")} km</strong></div>
                <div><span className="block text-xs text-green-700">Totaal</span><strong>{calculation.totalKm.toLocaleString("nl-NL")} km</strong></div>
                <div><span className="block text-xs text-green-700">Bedrag à € 0,23/km</span><strong>{money(calculation.amount)}</strong></div>
              </div>}
            </> : <label className="space-y-1.5"><span className="text-sm font-medium">Bedrag</span><Input type="number" min="0" step="0.01" inputMode="decimal" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} placeholder="0,00" /></label>}

            <label className="space-y-1.5"><span className="text-sm font-medium">Rekeningnummer</span><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} autoCapitalize="characters" placeholder="NL00 BANK 0000 0000 00" /></label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Rekeninghouder</span><Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></label>
            <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Bon {kind === "overig" ? "(verplicht)" : "(optioneel)"}</span><Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="h-auto py-2" /><span className="block text-xs text-muted-foreground">Foto, JPG, PNG, WebP of PDF — maximaal 10 MB.</span></label>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Annuleren</Button><Button onClick={submit} disabled={saving}>{saving ? "Indienen…" : "Declaratie indienen"}</Button></div>
        </section>
      )}

      <div className="grid gap-3 lg:hidden">
        {filtered.map((item) => {
          const canModify = isAdmin || (item.status === "pending" && !item.paid_at && item.submitted_by === userId);
          return <article key={item.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{item.board_member_name}</p><p className="text-sm text-muted-foreground">{fmtDate(item.expense_date)} · {item.declaration_type === "reiskosten" ? "Reiskosten" : "Overige kosten"}</p></div><strong className="shrink-0">{money(item.amount)}</strong></div>
            <p className="mt-3 break-words text-sm">{item.appointment || "Geen omschrijving"}</p>{item.trajectory && <p className="mt-1 break-words text-sm text-muted-foreground">{item.trajectory}{item.km_return ? ` · ${item.km_return} km` : ""}</p>}
            <div className="mt-3 flex flex-wrap gap-2">{statusBadge(item.status)}{informerBadge(item)}</div>
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {item.receipt_path && <Button size="sm" variant="outline" onClick={() => viewReceipt(item.receipt_path!)}><Receipt className="mr-1 h-4 w-4" />Bon</Button>}
              {isAdmin && item.status !== "approved" && <Button size="sm" variant="outline" onClick={() => onApprove(item.id)}><Check className="mr-1 h-4 w-4" />Goedkeuren</Button>}
              {isAdmin && item.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => onReject(item.id)}><X className="mr-1 h-4 w-4" />Afwijzen</Button>}
              {canModify && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="mr-1 h-4 w-4" />Verwijderen</Button>}
            </div>
          </article>;
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full min-w-[72rem] text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-3">Datum</th><th className="p-3">Bestuurslid</th><th className="p-3">Omschrijving</th><th className="p-3">Traject</th><th className="p-3 text-right">Km</th><th className="p-3 text-right">Bedrag</th><th className="p-3">Status</th><th className="p-3">Informer</th><th className="p-3">Acties</th></tr></thead>
          <tbody>{filtered.map((item) => { const canModify = isAdmin || (item.status === "pending" && !item.paid_at && item.submitted_by === userId); return <tr key={item.id} className="border-t align-top">
            <td className="p-3 whitespace-nowrap">{fmtDate(item.expense_date)}</td><td className="p-3 font-medium">{item.board_member_name}</td><td className="p-3">{item.appointment || "–"}</td><td className="max-w-xs p-3 break-words text-muted-foreground">{item.trajectory || "–"}</td><td className="p-3 text-right">{item.km_return ?? "–"}</td><td className="p-3 text-right"><CurrencyCell value={item.amount} /></td><td className="p-3">{statusBadge(item.status)}</td><td className="p-3">{informerBadge(item)}</td>
            <td className="p-3"><div className="flex gap-1">{item.receipt_path && <Button size="icon" variant="ghost" title="Bekijk bon" onClick={() => viewReceipt(item.receipt_path!)}><FileText className="h-4 w-4" /></Button>}{isAdmin && item.status !== "approved" && <Button size="icon" variant="ghost" title="Goedkeuren" onClick={() => onApprove(item.id)}><Check className="h-4 w-4 text-green-600" /></Button>}{isAdmin && item.status !== "rejected" && <Button size="icon" variant="ghost" title="Afwijzen" onClick={() => onReject(item.id)}><X className="h-4 w-4 text-destructive" /></Button>}{canModify && <Button size="icon" variant="ghost" title="Verwijderen" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></td>
          </tr>; })}</tbody>
          <tfoot className="border-t bg-muted/40 font-semibold"><tr><td colSpan={5} className="p-3">Totaal ({filtered.length})</td><td className="p-3 text-right"><CurrencyCell value={total} /></td><td colSpan={3} /></tr></tfoot>
        </table>
      </div>
      {filtered.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Geen declaraties gevonden.</div>}
    </div>
  );
}
