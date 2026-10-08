import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Download, FileText, MapPin, Plus, Receipt, Search, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_KM_RATE, calculateTravelDeclaration } from "@/lib/declarations";
import { computeOpenTotals, formOpenNote, openMemberKey, selectOpenDeclarations } from "@/lib/declarationOpenTotals";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeclarationSyncErrors, type DeclarationBoardMember, type InternalDeclaration } from "@/hooks/useInternalDeclarations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";
import { toast } from "sonner";

type AddDeclarationInput = {
  declaration: Omit<InternalDeclaration, "id" | "reviewed_by" | "reviewed_at">;
  receipts?: File[];
  asConcept?: boolean;
};

type AddDeclarationResult = { id: string; informerSynced: boolean; concept?: boolean } | void;

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
  onSubmitConcept?: (id: string) => void;
  onRetryInformer?: (id: string) => void;
}

const fmtDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("nl-NL").format(new Date(`${value}T12:00:00`))
  : "–";

const money = (value: number) => new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
}).format(value);

const statusBadge = (status: string) => {
  if (status === "concept") return <Badge variant="outline">Concept</Badge>;
  if (status === "approved") return <Badge className="bg-green-600">Goedgekeurd</Badge>;
  if (status === "rejected") return <Badge variant="destructive">Afgewezen</Badge>;
  return <Badge variant="secondary">In afwachting</Badge>;
};

const informerBadge = (declaration: InternalDeclaration, showError?: string) => {
  if (declaration.status === "concept") return null;
  if (declaration.informer_status === "sent" || declaration.informer_status === "synced") {
    return <Badge className="bg-green-600">Naar Informer verzonden</Badge>;
  }
  if (declaration.informer_status === "error") {
    return <Badge variant="destructive" title={showError || undefined}>Synchronisatie mislukt</Badge>;
  }
  return <Badge variant="outline">Ingediend</Badge>;
};

const canRetry = (d: InternalDeclaration) =>
  d.status !== "concept" && d.status !== "rejected" && (d.informer_status === "error" || d.informer_status === "not_sent" || d.informer_status === "queued");

const memberAddress = (member?: DeclarationBoardMember) => [
  member?.prive_adres,
  [member?.prive_postcode, member?.prive_plaats].filter(Boolean).join(" "),
].filter(Boolean).join(", ");

export default function InternalDeclarationsView({
  declarations, boardMembers, year, isAdmin, userId, onAdd, onDelete, onApprove, onReject, onSubmitConcept, onRetryInformer,
}: Props) {
  const { data: syncErrorData } = useDeclarationSyncErrors(isAdmin);
  const syncErrors: Record<string, string> = isAdmin ? syncErrorData ?? {} : {};
  const [adding, setAdding] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
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
  const [eventId, setEventId] = useState("");
  const [agendaEvents, setAgendaEvents] = useState<{ id: string; title: string; event_date: string; location: string | null }[]>([]);
  useEffect(() => {
    const from = new Date(); from.setMonth(from.getMonth() - 3);
    const to = new Date(); to.setMonth(to.getMonth() + 1);
    supabase.from("agenda_events").select("id,title,event_date,location")
      .is("cancelled_at", null)
      .gte("event_date", from.toISOString().slice(0, 10))
      .lte("event_date", to.toISOString().slice(0, 10))
      .order("event_date", { ascending: false })
      .then(({ data }) => setAgendaEvents((data as any) ?? []));
  }, []);

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
  const openTotals = useMemo(() => computeOpenTotals(declarations as any, { year, isAdmin, userId }), [declarations, year, isAdmin, userId]);
  // Melding onder het formulier: per gekozen bestuurslid (binnen de eigen toegankelijke cijfers), anders algemeen.
  // Drilldown: exact dezelfde records als het open totaal, los van zoek- en statusfilter.
  const openRows = useMemo(() => selectOpenDeclarations(declarations, { year, isAdmin, userId })
    .sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || "")), [declarations, year, isAdmin, userId]);
  const [drill, setDrill] = useState<{ key: string | null; name: string } | null>(null);
  const drillRows = drill ? openRows.filter((d) => drill.key === null || openMemberKey(d) === drill.key) : [];
  const drillCents = drillRows.reduce((sum, d) => sum + Math.round(Number(d.amount) * 100), 0);
  const formNote = formOpenNote(openTotals, { year, isAdmin, member: boardMembers.find((m) => m.id === memberId) ?? null });

  const chooseMember = async (id: string) => {
    setMemberId(id);
    const member = boardMembers.find((item) => item.id === id);
    setOrigin(memberAddress(member));
    setAccountHolder(member?.naam || "");
    setOneWayKm(null);
    const local = [...declarations]
      .filter((d) => d.bank_account && (d.board_member_id === id || (member && d.board_member_name === member.naam)))
      .sort((a, b) => (b.expense_date || "").localeCompare(a.expense_date || ""))[0];
    if (local?.bank_account) { setBankAccount(local.bank_account); if (local.account_holder) setAccountHolder(local.account_holder); return; }
    setBankAccount("");
    const { data } = await supabase
      .from("internal_declarations")
      .select("bank_account, account_holder, board_member_id, board_member_name, expense_date")
      .not("bank_account", "is", null)
      .or(`board_member_id.eq.${id}${member ? `,board_member_name.eq."${member.naam.replace(/"/g, "")}"` : ""}`)
      .order("expense_date", { ascending: false })
      .limit(1);
    const prev = data?.[0];
    if (prev?.bank_account) { setBankAccount(prev.bank_account); if (prev.account_holder) setAccountHolder(prev.account_holder); }
  };

  const [manualKm, setManualKm] = useState("");
  useEffect(() => {
    if (kind !== "reiskosten" || !origin.trim() || !destination.trim() || oneWayKm != null) return;
    const t = setTimeout(() => { void calculateRoute(true); }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, kind]);

  const calculateRoute = async (silent = false) => {
    if (!origin.trim() || !destination.trim()) {
      if (!silent) toast.error("Vul eerst het vertrek- en bestemmingsadres in");
      return;
    }
    setCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("calculate-route", {
        body: { origin: origin.trim(), destination: destination.trim() },
      });
      if (error) {
        let msg = "De afstand kon niet worden berekend. Vul de kilometers zelf in.";
        try { const body = await (error as any).context?.json?.(); if (body?.error) msg = body.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (!data?.one_way_km) throw new Error(data?.error || "De afstand kon niet worden berekend");
      setOneWayKm(Number(data.one_way_km)); setManualKm("");
      toast.success(`Afstand berekend: ${Number(data.one_way_km).toLocaleString("nl-NL")} km enkele reis`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "De afstand kon niet worden berekend");
    } finally {
      setCalculating(false);
    }
  };

  const pickEvent = (id: string) => {
    if (id === "none") { setEventId(""); return; }
    const ev = agendaEvents.find((e) => e.id === id);
    if (!ev) return;
    setEventId(id);
    setDescription(ev.title);
    setExpenseDate(String(ev.event_date).slice(0, 10));
    if (!destination.trim() && ev.location) setDestination(ev.location);
  };

  const resetForm = () => {
    // Bestuurslid, soort, vertrekadres en rekeninggegevens blijven; bon, bedrag, omschrijving en route niet.
    setEventId(""); setDescription(""); setDestination(""); setOneWayKm(null); setManualKm(""); setOtherAmount(""); setReceipt(null);
    setExpenseDate(new Date().toISOString().slice(0, 10));
  };

  const formRef = useRef<HTMLElement | null>(null);
  const focusForm = () => setTimeout(() => {
    formRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    formRef.current?.querySelector<HTMLElement>("button, input")?.focus({ preventScroll: true });
  }, 0);
  // Opent een leeg formulier; staat het formulier al open, dan blijft de invulling staan en scrollen we erheen.
  const startNew = () => {
    setJustSubmitted(false);
    if (!adding) { resetForm(); setAdding(true); }
    focusForm();
  };
  const startAnother = startNew;

  const submit = async (asConcept = false) => {
    const validationError = !selectedMember ? "Selecteer eerst het bestuurslid"
      : !expenseDate ? "Kies de datum van de kosten"
      : !description.trim() ? "Vul een korte omschrijving in"
      : !bankAccount.trim() ? "Vul het rekeningnummer in"
      : !accountHolder.trim() ? "Vul de rekeninghouder in"
      : kind === "reiskosten" && !calculation ? "Bereken eerst de afstand"
      : kind !== "reiskosten" && (!otherAmount || Number(otherAmount) <= 0) ? "Vul het bedrag in"
      : kind !== "reiskosten" && !receipt ? "Voeg een foto of PDF van de bon toe"
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
          paid_at: null, bank_transaction_id: null, receipt_path: null, informer_status: "not_sent", event_id: eventId || null,
          informer_external_id: null, informer_synced_at: null,
        }, receipts: receipt ? [receipt] : [], asConcept,
      });
      if (result && result.concept) {
        toast.success("Concept opgeslagen; dien het later definitief in");
      } else if (result && !result.informerSynced) {
        toast.warning("Declaratie is ingediend, maar het versturen naar Informer is mislukt. De penningmeester kan het opnieuw proberen.");
      } else {
        toast.success("Declaratie ingediend en naar Informer verzonden");
      }
      resetForm(); setAdding(false); setJustSubmitted(!(result && result.concept));
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
          <SelectContent><SelectItem value="all">Alle statussen</SelectItem><SelectItem value="concept">Concept</SelectItem><SelectItem value="pending">In afwachting</SelectItem><SelectItem value="approved">Goedgekeurd</SelectItem><SelectItem value="rejected">Afgewezen</SelectItem></SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button onClick={startNew}><Plus className="mr-2 h-4 w-4" />{openTotals.count > 0 ? "Nieuwe aparte declaratie" : "Declaratie indienen"}</Button>
      </div>

      <section aria-label="Openstaand totaal" className="rounded-lg border bg-card">
        <button type="button" onClick={() => setDrill({ key: null, name: isAdmin ? "alle bestuurders" : "mijn declaraties" })}
          aria-label="Bekijk openstaande declaraties"
          className="flex w-full flex-wrap items-baseline justify-between gap-2 rounded-lg p-4 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div>
            <h3 className="text-sm font-semibold">Openstaand {year}{isAdmin ? "" : " (mijn declaraties)"}</h3>
            <p className="text-xs text-muted-foreground">Ingediend of goedgekeurd en nog niet betaald. Telt los van het statusfilter. Klik om ze te bekijken.</p>
          </div>
          <div className="flex items-center gap-2 text-right"><div><strong className="text-lg tabular-nums"><CurrencyCell value={openTotals.cents / 100} /></strong><span className="block text-xs text-muted-foreground">{openTotals.count} {openTotals.count === 1 ? "declaratie" : "declaraties"}</span></div><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /></div>
        </button>
        {isAdmin && openTotals.perMember.length > 0 && (
          <ul className="mx-4 mb-3 divide-y border-t text-sm">
            {openTotals.perMember.map((m) => <li key={m.key}>
              <button type="button" onClick={() => setDrill({ key: m.key, name: m.name })} aria-label={`Bekijk openstaande declaraties van ${m.name}`}
                className="flex w-full items-center justify-between gap-2 rounded px-1 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span>{m.name} <span className="text-muted-foreground">({m.count})</span></span>
                <span className="flex items-center gap-1 tabular-nums"><CurrencyCell value={m.cents / 100} /><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden /></span>
              </button>
            </li>)}
          </ul>
        )}
      </section>

      <Dialog open={drill !== null} onOpenChange={(o) => { if (!o) setDrill(null); }}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Openstaand {year} — {drill?.name}</DialogTitle>
            <DialogDescription data-testid="drill-summary">{drillRows.length} {drillRows.length === 1 ? "declaratie" : "declaraties"} · {money(drillCents / 100)}</DialogDescription>
          </DialogHeader>
          {drillRows.length === 0 ? <p className="text-sm text-muted-foreground">Geen openstaande declaraties.</p> : (
            <ul className="divide-y text-sm" data-testid="drill-list">
              {drillRows.map((d) => <li key={d.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium break-words">{d.appointment || "Geen omschrijving"}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(d.expense_date)} · {d.declaration_type === "reiskosten" ? "Kilometervergoeding" : d.declaration_type === "overig" ? "Overige reiskosten" : d.declaration_type}{drill?.key === null && isAdmin ? ` · ${d.board_member_name}` : ""}</p>
                  <div className="mt-1 flex flex-wrap gap-1">{statusBadge(d.status)}{informerBadge(d)}</div>
                </div>
                <strong className="shrink-0 tabular-nums">{money(d.amount)}</strong>
              </li>)}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      {justSubmitted && !adding && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Je declaratie is apart ingediend. Heb je nog meer kosten? Die worden bij het openstaande totaal opgeteld.</p>
          <Button onClick={startAnother}><Plus className="mr-2 h-4 w-4" />Nog een declaratie indienen</Button>
        </div>
      )}

      {adding && (
        <section ref={formRef} aria-label="Nieuwe declaratie" className="scroll-mt-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-5"><h2 className="text-lg font-semibold">Nieuwe declaratie</h2><p className="text-sm text-muted-foreground">Kies eerst voor welk bestuurslid de kosten zijn gemaakt.</p></div>
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <label className="min-w-0 space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Bestuurslid</span>
              <Select value={memberId} onValueChange={chooseMember}><SelectTrigger><SelectValue placeholder="Selecteer een bestuurslid" /></SelectTrigger><SelectContent>{boardMembers.map((member) => <SelectItem key={member.id} value={member.id}>{member.naam}{member.functie ? ` — ${member.functie}` : ""}</SelectItem>)}</SelectContent></Select>
            </label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Soort declaratie</span>
              <Select value={kind} onValueChange={(value: "reiskosten" | "overig") => { setKind(value); setOneWayKm(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reiskosten">Kilometervergoeding</SelectItem><SelectItem value="overig">Overige reiskosten (OV, parkeren e.d.)</SelectItem></SelectContent></Select>
            </label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Datum</span><Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} /></label>
            <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Evenement / bijeenkomst (optioneel)</span>
              <Select value={eventId || "none"} onValueChange={pickEvent}>
                <SelectTrigger><SelectValue placeholder="Kies een evenement of bijeenkomst" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen evenement</SelectItem>
                  {agendaEvents.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>{new Date(ev.event_date).toLocaleDateString("nl-NL")} — {ev.title}{ev.location ? ` (${ev.location})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Omschrijving</span><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={kind === "reiskosten" ? "Bijvoorbeeld: bestuursvergadering Utrecht" : "Bijvoorbeeld: treinkaartje of parkeren Utrecht"} /></label>

            {kind === "reiskosten" ? <>
              <label className="space-y-1.5"><span className="text-sm font-medium">Van</span><Input value={origin} onChange={(e) => { setOrigin(e.target.value); setOneWayKm(null); setManualKm(""); }} placeholder="Vertrekadres" /></label>
              <label className="space-y-1.5"><span className="text-sm font-medium">Naar</span><Input value={destination} onChange={(e) => { setDestination(e.target.value); setOneWayKm(null); setManualKm(""); }} placeholder="Bestemmingsadres" /></label>
              <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 md:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={returnTrip} onCheckedChange={(checked) => { const rt = checked === true; if (manualKm) { const v = Number(manualKm.replace(",", ".")); setOneWayKm(v > 0 ? v / (rt ? 2 : 1) : null); } setReturnTrip(rt); }} />Heen en terug</label>
                <Button type="button" variant="outline" onClick={() => calculateRoute()} disabled={calculating}><MapPin className="mr-2 h-4 w-4" />{calculating ? "Afstand berekenen…" : "Bereken afstand"}</Button>
              </div>
              <label className="space-y-1.5"><span className="text-sm font-medium">Km (totaal)</span><Input type="number" min="0" step="0.1" inputMode="decimal" value={manualKm !== "" ? manualKm : calculation ? String(calculation.totalKm) : ""} onChange={(e) => { setManualKm(e.target.value); const v = Number(e.target.value.replace(",", ".")); setOneWayKm(e.target.value && v > 0 ? v / (returnTrip ? 2 : 1) : null); }} placeholder="Wordt automatisch berekend" /></label>
              <div className="hidden md:block" />
              {calculation && <div className="grid grid-cols-2 gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-950 md:col-span-2 sm:grid-cols-3">
                <div><span className="block text-xs text-green-700">Enkele reis</span><strong>{calculation.oneWayKm.toLocaleString("nl-NL")} km</strong></div>
                <div><span className="block text-xs text-green-700">Totaal</span><strong>{calculation.totalKm.toLocaleString("nl-NL")} km</strong></div>
                <div><span className="block text-xs text-green-700">Bedrag à € 0,23/km</span><strong>{money(calculation.amount)}</strong></div>
              </div>}
            </> : <label className="space-y-1.5"><span className="text-sm font-medium">Bedrag</span><Input type="number" min="0" step="0.01" inputMode="decimal" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} placeholder="0,00" /></label>}

            <label className="space-y-1.5"><span className="text-sm font-medium">Rekeningnummer</span><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} autoCapitalize="characters" placeholder="NL00 BANK 0000 0000 00" /></label>
            <label className="space-y-1.5"><span className="text-sm font-medium">Rekeninghouder</span><Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} /></label>
            <label className="space-y-1.5 md:col-span-2"><span className="text-sm font-medium">Bon {kind !== "reiskosten" ? "(verplicht)" : "(optioneel)"}</span><Input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setReceipt(e.target.files?.[0] || null)} className="h-auto py-2" /><span className="block text-xs text-muted-foreground">Foto, JPG, PNG, WebP of PDF — maximaal 10 MB.</span></label>
          </div>
          {formNote && (
            <p data-testid="form-open-total" className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">{formNote}</p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>Annuleren</Button><Button variant="outline" onClick={() => submit(true)} disabled={saving}>Opslaan als concept</Button><Button onClick={() => submit(false)} disabled={saving}>{saving ? "Indienen…" : "Declaratie definitief indienen"}</Button></div>
        </section>
      )}

      <div className="grid gap-3 lg:hidden">
        {filtered.map((item) => {
          const canModify = isAdmin || (item.status === "pending" && !item.paid_at && item.submitted_by === userId);
          return <article key={item.id} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{item.board_member_name}</p><p className="text-sm text-muted-foreground">{fmtDate(item.expense_date)} · {item.declaration_type === "reiskosten" ? "Reiskosten" : "Overige kosten"}</p></div><strong className="shrink-0">{money(item.amount)}</strong></div>
            <p className="mt-3 break-words text-sm">{item.appointment || "Geen omschrijving"}</p>{item.trajectory && <p className="mt-1 break-words text-sm text-muted-foreground">{item.trajectory}{item.km_return ? ` · ${item.km_return} km` : ""}</p>}
            <div className="mt-3 flex flex-wrap gap-2">{statusBadge(item.status)}{informerBadge(item, syncErrors[item.id])}</div>{isAdmin && item.informer_status === "error" && syncErrors[item.id] && <p className="mt-2 break-words text-xs text-destructive">{syncErrors[item.id]}</p>}
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
              {item.receipt_path && <Button size="sm" variant="outline" onClick={() => viewReceipt(item.receipt_path!)}><Receipt className="mr-1 h-4 w-4" />Bon</Button>}
              {isAdmin && item.status !== "approved" && <Button size="sm" variant="outline" onClick={() => onApprove(item.id)}><Check className="mr-1 h-4 w-4" />Goedkeuren</Button>}
              {item.status === "concept" && item.submitted_by === userId && onSubmitConcept && <Button size="sm" onClick={() => onSubmitConcept(item.id)}>Definitief indienen</Button>}
              {isAdmin && canRetry(item) && onRetryInformer && <Button size="sm" variant="outline" onClick={() => onRetryInformer(item.id)}>Opnieuw naar Informer sturen</Button>}
              {isAdmin && item.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => onReject(item.id)}><X className="mr-1 h-4 w-4" />Afwijzen</Button>}
              {canModify && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(item.id)}><Trash2 className="mr-1 h-4 w-4" />Verwijderen</Button>}
            </div>
          </article>;
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border lg:block">
        <table className="w-full min-w-[72rem] text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr><th className="p-3">Datum</th><th className="p-3">Bestuurslid</th><th className="p-3">Omschrijving</th><th className="p-3">Traject</th><th className="p-3 text-right">Km</th><th className="p-3 text-right">Bedrag</th><th className="p-3">Status</th><th className="p-3">Informer</th><th className="p-3">Acties</th></tr></thead>
          <tbody>{filtered.map((item) => { const canModify = isAdmin || (item.status === "pending" && !item.paid_at && item.submitted_by === userId); return <tr key={item.id} className="border-t align-top">
            <td className="p-3 whitespace-nowrap">{fmtDate(item.expense_date)}</td><td className="p-3 font-medium">{item.board_member_name}</td><td className="p-3">{item.appointment || "–"}</td><td className="max-w-xs p-3 break-words text-muted-foreground">{item.trajectory || "–"}</td><td className="p-3 text-right">{item.km_return ?? "–"}</td><td className="p-3 text-right"><CurrencyCell value={item.amount} /></td><td className="p-3">{statusBadge(item.status)}</td><td className="p-3">{informerBadge(item, syncErrors[item.id])}{isAdmin && item.informer_status === "error" && syncErrors[item.id] && <p className="mt-1 max-w-[16rem] break-words text-xs text-destructive">{syncErrors[item.id]}</p>}</td>
            <td className="p-3"><div className="flex gap-1">{item.receipt_path && <Button size="icon" variant="ghost" title="Bekijk bon" onClick={() => viewReceipt(item.receipt_path!)}><FileText className="h-4 w-4" /></Button>}{isAdmin && item.status !== "approved" && <Button size="icon" variant="ghost" title="Goedkeuren" onClick={() => onApprove(item.id)}><Check className="h-4 w-4 text-green-600" /></Button>}{item.status === "concept" && item.submitted_by === userId && onSubmitConcept && <Button size="sm" variant="outline" onClick={() => onSubmitConcept(item.id)}>Indienen</Button>}{isAdmin && canRetry(item) && onRetryInformer && <Button size="sm" variant="outline" onClick={() => onRetryInformer(item.id)}>Opnieuw naar Informer sturen</Button>}{isAdmin && item.status !== "rejected" && <Button size="icon" variant="ghost" title="Afwijzen" onClick={() => onReject(item.id)}><X className="h-4 w-4 text-destructive" /></Button>}{canModify && <Button size="icon" variant="ghost" title="Verwijderen" onClick={() => onDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</div></td>
          </tr>; })}</tbody>
          <tfoot className="border-t bg-muted/40 font-semibold"><tr><td colSpan={5} className="p-3">Totaal ({filtered.length})</td><td className="p-3 text-right"><CurrencyCell value={total} /></td><td colSpan={3} /></tr></tfoot>
        </table>
      </div>
      {filtered.length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Geen declaraties gevonden.</div>}
    </div>
  );
}
