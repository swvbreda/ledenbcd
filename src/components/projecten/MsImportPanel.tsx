import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDownToLine, CalendarDays, ListChecks, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { msImportConfirmCalendar, msImportListCalendars, msImportRunNow, msImportSetGeneralBucket } from "@/lib/msImport.functions";

const db = supabase as any;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface MsImportSettingsView {
  enabled: boolean; release_gate: boolean; agenda_mailbox: string; agenda_calendar_id: string | null; agenda_calendar_name: string | null;
  agenda_confirmed_at: string | null; planner_mode: string; planner_general_bucket_id: string | null; planner_general_bucket_name: string | null;
}

/** Beheer van de eenrichtingsimport (Microsoft leidend). Alleen beheerders; niets wordt naar Microsoft geschreven. */
export default function MsImportPanel({ buckets }: { buckets: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const listFn = useServerFn(msImportListCalendars);
  const confirmFn = useServerFn(msImportConfirmCalendar);
  const bucketFn = useServerFn(msImportSetGeneralBucket);
  const runFn = useServerFn(msImportRunNow);

  const settingsQ = useQuery({
    queryKey: ["ms-import-settings"],
    queryFn: async () => { const { data, error } = await db.from("ms_import_settings").select("*").maybeSingle(); if (error) throw error; return data as MsImportSettingsView | null; },
  });
  const countsQ = useQuery({
    queryKey: ["ms-import-counts"],
    queryFn: async () => {
      const head = (t: string, f?: (q: any) => any) => { let q = db.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); return q; };
      const [a, p, u, c, r] = await Promise.all([
        head("ms_agenda_import_links"), head("ms_planner_import_links"), head("ms_planner_unprocessed"),
        head("ms_import_conflicts", (q) => q.is("resolved_at", null)),
        db.from("ms_import_runs").select("trigger,started_at,ok").order("started_at", { ascending: false }).limit(1),
      ]);
      return { agenda: a.count ?? 0, planner: p.count ?? 0, unprocessed: u.count ?? 0, conflicts: c.count ?? 0, last: r.data?.[0] ?? null };
    },
  });
  const [showCals, setShowCals] = useState(false);
  const calsQ = useQuery({ queryKey: ["ms-import-calendars"], enabled: showCals, queryFn: () => listFn(), retry: 0 });
  const [calId, setCalId] = useState("");
  const [bucketId, setBucketId] = useState("");
  const refresh = () => { qc.invalidateQueries({ queryKey: ["ms-import-settings"] }); qc.invalidateQueries({ queryKey: ["ms-import-counts"] }); };

  const confirm = useMutation({
    mutationFn: (id: string | null) => confirmFn({ data: { calendarId: id } }),
    onSuccess: (r) => { toast.success(r.name ? `Agenda "${r.name}" bevestigd` : "Agendakeuze gewist"); setCalId(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const setBucket = useMutation({
    mutationFn: (id: string | null) => bucketFn({ data: { bucketId: id } }),
    onSuccess: () => { toast.success("Algemene bucket opgeslagen"); setBucketId(""); refresh(); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const run = useMutation({
    mutationFn: () => runFn(),
    onSuccess: (r) => {
      const a = r.agenda.counts;
      toast.success(`Import klaar. Agenda: ${r.agenda.status}${a ? ` (${a.created ?? 0} nieuw, ${a.updated ?? 0} bijgewerkt, ${a.cancelled ?? 0} geannuleerd)` : ""}; Planner: ${r.planner.length} bucket(s)`);
      refresh(); qc.invalidateQueries({ queryKey: ["internal-tasks"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const s = settingsQ.data;
  const cals = calsQ.data?.ok ? calsQ.data.calendars : [];
  const scheduled = s?.enabled && s?.release_gate;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4" aria-label="Import uit Teams en Outlook">
      <div className="flex flex-wrap items-center gap-2">
        <ArrowDownToLine className="h-4 w-4 text-brand-red" />
        <h2 className="font-display uppercase tracking-tight">Import uit Teams/Outlook</h2>
        <Badge variant="outline">Alleen lezen uit Microsoft</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Microsoft is leidend. Nieuwe en gewijzigde afspraken en taken worden hierheen gehaald; er wordt nooit iets naar Outlook of Planner geschreven.
        Geïmporteerde afspraken komen verborgen binnen tot je ze in de agenda publiceert.
      </p>

      {settingsQ.isLoading ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Laden…</p> : !s ? (
        <p className="text-sm text-destructive">Importinstellingen ontbreken.</p>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-red" />BCD-agenda</h3>
            <p className="text-sm break-words">
              Postbus <span className="font-medium">{s.agenda_mailbox}</span> —{" "}
              {s.agenda_calendar_id ? <>agenda <span className="font-medium">"{s.agenda_calendar_name}"</span> bevestigd</> : <span className="text-muted-foreground">nog geen agenda bevestigd: er wordt niets gelezen</span>}
            </p>
            {!showCals ? (
              <Button size="sm" variant="outline" onClick={() => setShowCals(true)}>Agenda's ophalen</Button>
            ) : calsQ.isLoading ? <p className="text-sm text-muted-foreground">Agenda's ophalen…</p>
              : calsQ.data && !calsQ.data.ok ? <p className="text-sm text-destructive break-words">Niet leesbaar: {calsQ.data.error}</p>
              : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="space-y-1 min-w-0 flex-1">
                    <Label>Aparte agenda (nooit de standaardagenda)</Label>
                    <Select value={calId} onValueChange={setCalId}>
                      <SelectTrigger><SelectValue placeholder="Kies agenda" /></SelectTrigger>
                      <SelectContent>
                        {cals.map((c) => <SelectItem key={c.id} value={c.id} disabled={!c.selectable}>{c.name}{!c.selectable ? " (standaard, niet kiesbaar)" : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button size="sm" disabled={!calId || confirm.isPending} onClick={() => confirm.mutate(calId)}>Deze agenda bevestigen</Button>
                </div>
              )}
            {s.agenda_calendar_id && <Button size="sm" variant="ghost" disabled={confirm.isPending} onClick={() => { if (window.confirm("Agendakeuze wissen? Daarna wordt er niets meer gelezen.")) confirm.mutate(null); }}>Agendakeuze wissen</Button>}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2"><ListChecks className="h-4 w-4 text-brand-red" />Planner "To do"</h3>
            <p className="text-sm">Modus: <Badge variant={s.planner_mode === "import" ? "default" : "outline"}>{s.planner_mode === "import" ? "Leesmodus (Microsoft leidend)" : "Tweerichting"}</Badge></p>
            <p className="text-xs text-muted-foreground">Alleen buckets die hierboven aan een project zijn gekoppeld worden geïmporteerd. Taken in de algemene bucket komen in een aparte lijst, niet in een project.</p>
            <p className="text-sm break-words">Algemene bucket: {s.planner_general_bucket_name ? <span className="font-medium">"{s.planner_general_bucket_name}"</span> : <span className="text-muted-foreground">niet gekozen</span>}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1 min-w-0 flex-1">
                <Label>Bucket als onverwerkte bronlijst</Label>
                <Select value={bucketId} onValueChange={setBucketId}>
                  <SelectTrigger><SelectValue placeholder={buckets.length ? "Kies bucket" : "Geen buckets geladen"} /></SelectTrigger>
                  <SelectContent>{buckets.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button size="sm" variant="outline" disabled={!bucketId || setBucket.isPending} onClick={() => setBucket.mutate(bucketId)}>Opslaan</Button>
            </div>
          </div>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm">
              Gekoppeld: {countsQ.data?.agenda ?? 0} afspraken, {countsQ.data?.planner ?? 0} taken; {countsQ.data?.unprocessed ?? 0} onverwerkt, {countsQ.data?.conflicts ?? 0} ter review.
            </p>
            <p className="text-xs text-muted-foreground">
              Automatisch elk uur: {scheduled ? "aan" : "uit"}{!s.release_gate ? " (wacht op releasevrijgave)" : ""}.
              {countsQ.data?.last ? ` Laatste run: ${new Date(countsQ.data.last.started_at).toLocaleString("nl-NL")} (${countsQ.data.last.ok ? "geslaagd" : countsQ.data.last.ok === false ? "mislukt" : "bezig"}).` : " Nog geen run."}
            </p>
            <Button size="sm" disabled={run.isPending || (!s.agenda_calendar_id && s.planner_mode !== "import")} onClick={() => { if (window.confirm("Nu importeren uit Microsoft? Er wordt niets naar Microsoft geschreven.")) run.mutate(); }}>
              {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}Nu importeren
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
