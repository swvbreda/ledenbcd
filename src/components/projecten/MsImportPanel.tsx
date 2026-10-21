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
import { useAuth } from "@/hooks/useAuth";
import { IMPORT_CALENDAR_ID, importOutcome, importReadiness } from "@/lib/msImport";
import { msImportConfirmCalendar, msImportListCalendars, msImportRunNow, msImportSetGeneralBucket } from "@/lib/msImport.functions";

const db = supabase as any;
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface MsImportSettingsView {
  enabled: boolean; release_gate: boolean; agenda_mailbox: string; agenda_calendar_id: string | null; agenda_calendar_name: string | null;
  agenda_confirmed_at: string | null; planner_mode: string; planner_general_bucket_id: string | null; planner_general_bucket_name: string | null;
}
interface Unprocessed { planner_task_id: string; title: string; due: string | null; percent: number; assignee_count: number; source_state: string }
interface Conflict { id: string; source: string; reason: string; created_at: string }

const READINESS: Record<string, string> = {
  uit: "Automatisch elk uur: uit.",
  wacht_op_release: "Automatisch elk uur: uit (wacht op releasevrijgave).",
  geen_trigger: "Automatisch elk uur: niet mogelijk — er is nog geen uurtrigger aangesloten.",
  aan: "Automatisch elk uur: aan.",
};
const REASON: Record<string, string> = {
  bestaand_app_item: "Afspraak bestaat al als app-item (niet dubbel geïmporteerd)",
  tweerichting_koppeling: "Taak heeft al een tweerichtingskoppeling (niet geïmporteerd)",
};

/** Beheer van de eenrichtingsimport (Microsoft leidend). Alleen beheerders; niets wordt naar Microsoft geschreven. */
export default function MsImportPanel({ buckets }: { buckets: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id ?? "anon";
  const listFn = useServerFn(msImportListCalendars);
  const confirmFn = useServerFn(msImportConfirmCalendar);
  const bucketFn = useServerFn(msImportSetGeneralBucket);
  const runFn = useServerFn(msImportRunNow);
  const key = (k: string) => ["ms-import", uid, k] as const;

  const settingsQ = useQuery({
    queryKey: key("settings"), enabled: !!user,
    queryFn: async () => { const { data, error } = await db.from("ms_import_settings").select("*").maybeSingle(); if (error) throw error; return data as MsImportSettingsView | null; },
  });
  const listsQ = useQuery({
    queryKey: key("lists"), enabled: !!user,
    queryFn: async () => {
      const head = (t: string) => db.from(t).select("*", { count: "exact", head: true });
      const [a, p, u, c, r] = await Promise.all([
        head("ms_agenda_import_links"), head("ms_planner_import_links"),
        db.from("ms_planner_unprocessed").select("planner_task_id,title,due,percent,assignee_count,source_state").order("created_at", { ascending: false }).limit(50),
        db.from("ms_import_conflicts").select("id,source,reason,created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(50),
        db.from("ms_import_runs").select("trigger,started_at,ok").order("started_at", { ascending: false }).limit(1),
      ]);
      for (const x of [a, p, u, c, r]) if (x.error) throw x.error;
      return { agenda: a.count ?? 0, planner: p.count ?? 0, unprocessed: (u.data ?? []) as Unprocessed[], conflicts: (c.data ?? []) as Conflict[], last: r.data?.[0] ?? null };
    },
  });
  const [showCals, setShowCals] = useState(false);
  const calsQ = useQuery({ queryKey: key("calendars"), enabled: showCals && !!user, queryFn: () => listFn(), retry: 0 });
  const [bucketId, setBucketId] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["ms-import", uid] });

  const confirm = useMutation({
    mutationFn: (id: string | null) => confirmFn({ data: { calendarId: id } }),
    onSuccess: (r) => { toast.success(r.name ? `Agenda "${r.name}" bevestigd` : "Agendakeuze gewist"); refresh(); },
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
      const o = importOutcome(r);
      if (o.ok) toast.success(`Import geslaagd. ${o.message}`); else toast.warning(`Import niet volledig. ${o.message}`);
      refresh(); qc.invalidateQueries({ queryKey: ["internal-tasks"] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const s = settingsQ.data;
  const pinned = calsQ.data?.ok ? calsQ.data.calendars.find((c) => c.id === IMPORT_CALENDAR_ID && c.selectable) ?? null : null;
  const l = listsQ.data;

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4 min-w-0" aria-label="Import uit Teams en Outlook">
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
        <p className="text-sm text-destructive">Importinstellingen ontbreken of zijn niet leesbaar.</p>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand-red" />BCD-agenda</h3>
            <p className="text-sm break-words">
              Postbus <span className="font-medium">{s.agenda_mailbox}</span> —{" "}
              {s.agenda_calendar_id === IMPORT_CALENDAR_ID ? <>agenda <span className="font-medium">"{s.agenda_calendar_name}"</span> bevestigd</>
                : s.agenda_calendar_id ? <span className="text-destructive">onbekende agenda opgeslagen; wis de keuze</span>
                : <span className="text-muted-foreground">nog geen agenda bevestigd: er wordt niets gelezen</span>}
            </p>
            {s.agenda_calendar_id !== IMPORT_CALENDAR_ID && (!showCals ? (
              <Button size="sm" variant="outline" onClick={() => setShowCals(true)}>Agenda's ophalen</Button>
            ) : calsQ.isLoading ? <p className="text-sm text-muted-foreground">BCD-agenda zoeken…</p>
              : calsQ.data && !calsQ.data.ok ? <p className="text-sm text-destructive break-words">Niet leesbaar: {calsQ.data.error}</p>
              : !pinned ? <p className="text-sm text-destructive">De bevestigde aparte BCD-agenda is niet gevonden in deze postbus. Er kan niets worden gekozen.</p>
              : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <p className="text-sm min-w-0 flex-1">Gevonden: <span className="font-medium">"{pinned.name}"</span> (aparte agenda, niet de standaardagenda)</p>
                  <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate(pinned.id)}>Deze agenda bevestigen</Button>
                </div>
              ))}
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
            <p className="text-sm">Gekoppeld: {l?.agenda ?? 0} afspraken, {l?.planner ?? 0} taken.</p>
            <div>
              <h4 className="text-sm font-medium">Onverwerkte taken uit algemene bucket ({l?.unprocessed.length ?? 0})</h4>
              {listsQ.isError ? <p className="text-sm text-destructive">Lijst niet leesbaar.</p> : !l?.unprocessed.length ? <p className="text-xs text-muted-foreground">Geen.</p> : (
                <ul className="divide-y divide-border text-sm">
                  {l.unprocessed.map((t) => (
                    <li key={t.planner_task_id} className="py-1.5 flex flex-wrap gap-x-3 gap-y-0.5 min-w-0">
                      <span className="font-medium break-words min-w-0">{t.title}</span>
                      <span className="text-muted-foreground tabular-nums">{t.due ?? "geen deadline"}</span>
                      <span className="text-muted-foreground">{t.percent >= 100 ? "afgerond" : t.percent > 0 ? "bezig" : "te doen"}</span>
                      {t.assignee_count === 0 && <span className="text-muted-foreground">geen eigenaar</span>}
                      {t.source_state !== "present" && <Badge variant="outline">{t.source_state === "missing" ? "niet meer in Planner" : "verplaatst"}</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium">Ter review ({l?.conflicts.length ?? 0})</h4>
              {!l?.conflicts.length ? <p className="text-xs text-muted-foreground">Geen.</p> : (
                <ul className="divide-y divide-border text-sm">
                  {l.conflicts.map((c) => (
                    <li key={c.id} className="py-1.5 flex flex-wrap gap-x-3 min-w-0">
                      <Badge variant="outline">{c.source === "agenda" ? "Agenda" : "Planner"}</Badge>
                      <span className="break-words min-w-0">{REASON[c.reason] ?? c.reason}</span>
                      <span className="text-muted-foreground tabular-nums">{new Date(c.created_at).toLocaleDateString("nl-NL")}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {READINESS[importReadiness(s)]}
              {l?.last ? ` Laatste run: ${new Date(l.last.started_at).toLocaleString("nl-NL")} (${l.last.ok ? "geslaagd" : l.last.ok === false ? "niet volledig" : "bezig"}).` : " Nog geen run."}
            </p>
            <Button size="sm" disabled={run.isPending} onClick={() => { if (window.confirm("Nu importeren uit Microsoft? Er wordt niets naar Microsoft geschreven.")) run.mutate(); }}>
              {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}Nu importeren
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
