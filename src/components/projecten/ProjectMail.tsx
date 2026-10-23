import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Copy, ExternalLink, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { surfaceCls, sectionHeadCls } from "@/components/projecten/ui";
import { PROJECTMAIL_MAILBOX } from "@/lib/projectMail";
import { projectMailCheck, projectMailRunNow, projectMailSchedulerStatus, projectMailSetEnabled } from "@/lib/projectMail.functions";

const sb = supabase as any;
const fmt = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }) : "—");

export function useProjectMailCodes() {
  return useQuery({
    queryKey: ["projectmail-codes"],
    queryFn: async () => {
      const { data, error } = await sb.from("project_mail_codes").select("project_id,reference_code,active");
      if (error) throw error;
      return new Map<string, { code: string; active: boolean }>((data ?? []).map((r: any) => [r.project_id, { code: r.reference_code, active: r.active }]));
    },
    staleTime: 60_000,
  });
}

export function mailtoFor(code: string) {
  return `mailto:${PROJECTMAIL_MAILBOX}?subject=${encodeURIComponent(`[${code}] `)}`;
}

/** Code + kopieerknop + onderwerpknop (opent eigen mailprogramma; app verstuurt niets). */
export function ProjectMailCode({ projectId, compact }: { projectId: string; compact?: boolean }) {
  const q = useProjectMailCodes();
  const c = q.data?.get(projectId);
  if (!c) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(`[${c.code}]`); toast.success("Code gekopieerd"); } catch { toast.error("Kopiëren lukte niet"); } };
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <code className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-foreground">[{c.code}]</code>
      {!c.active && <span className="text-muted-foreground">gepauzeerd</span>}
      <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={copy} aria-label={`Code ${c.code} kopiëren`}><Copy className="h-3.5 w-3.5" />{!compact && <span className="ml-1">Kopieer</span>}</Button>
      <Button size="sm" variant="ghost" className="h-8 px-2" asChild>
        <a href={mailtoFor(c.code)} aria-label={`Mail aan ${PROJECTMAIL_MAILBOX} met code`}><Mail className="h-3.5 w-3.5" />{!compact && <span className="ml-1">Mail met code</span>}</a>
      </Button>
    </div>
  );
}

/** Privé correspondentie (alleen beheerders) bij een project. */
export function ProjectMailCorrespondence({ projectId }: { projectId: string }) {
  const q = useQuery({
    queryKey: ["projectmail-messages", projectId],
    queryFn: async () => {
      const { data, error } = await sb.from("projectmail_messages").select("id,subject,received_at,web_link,status,summary,next_steps,reference_code")
        .eq("project_id", projectId).order("received_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data as any[];
    },
  });
  if (!q.data?.length) return null;
  return (
    <section aria-label="Correspondentie" className={`${surfaceCls} space-y-3 p-4`}>
      <h3 className={sectionHeadCls}>Correspondentie (intern, niet zichtbaar voor leden)</h3>
      <ul className="space-y-3">
        {q.data.map((m) => (
          <li key={m.id} className="space-y-1 border-t border-border pt-3 first:border-0 first:pt-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium break-words">{m.subject}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{fmt(m.received_at)}</span>
              {m.web_link && <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={m.web_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3 w-3" />Outlook</a>}
            </div>
            {m.status !== "verwerkt" && <p className="text-xs text-muted-foreground">{m.status === "fout" ? "Verwerking mislukt" : "Wordt verwerkt"}</p>}
            {m.summary && <p className="text-sm whitespace-pre-wrap break-words"><span className="font-medium">Stand van zaken: </span>{m.summary}</p>}
            {m.next_steps && <p className="text-sm whitespace-pre-wrap break-words"><span className="font-medium">Vervolg: </span>{m.next_steps}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

const STATE: Record<string, string> = { verbonden: "Verbonden", verbinding_nodig: "Verbinding nodig", fout: "Fout", onbekend: "Nog niet gecontroleerd" };
const REASON: Record<string, string> = {
  onbekende_code: "Onbekende code", meerdere_codes: "Meerdere codes", ongeldige_code: "Ongeldige code", project_gepauzeerd: "Project gepauzeerd",
  project_gearchiveerd: "Project gearchiveerd", taak_onzeker: "Mogelijke taak", taakstatus: "Status bestaande taak", verwerkingsfout: "Verwerkingsfout",
};

export default function ProjectMailPanel({ projects }: { projects: { id: string; title: string }[] }) {
  const qc = useQueryClient();
  const check = useServerFn(projectMailCheck), setEnabled = useServerFn(projectMailSetEnabled), runNow = useServerFn(projectMailRunNow), schedStatus = useServerFn(projectMailSchedulerStatus);
  const sched = useQuery({ queryKey: ["projectmail-scheduler"], queryFn: () => schedStatus() });
  const [busy, setBusy] = useState<string | null>(null);
  const codes = useProjectMailCodes();
  const s = useQuery({ queryKey: ["projectmail-settings"], queryFn: async () => {
    const { data, error } = await sb.from("projectmail_settings").select("mailbox,enabled,connection_state,connection_detail,connection_checked_at,last_run_at,last_success_at,last_error,last_error_at,consecutive_failures").maybeSingle();
    if (error) throw error; return data as any;
  } });
  const reviews = useQuery({ queryKey: ["projectmail-reviews"], queryFn: async () => {
    const { data, error } = await sb.from("projectmail_reviews").select("id,reason,subject,received_at,web_link,detail,project_id").is("resolved_at", null).order("created_at", { ascending: false }).limit(50);
    if (error) throw error; return data as any[];
  } });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["projectmail-settings"] }); qc.invalidateQueries({ queryKey: ["projectmail-reviews"] }); qc.invalidateQueries({ queryKey: ["projectmail-codes"] }); qc.invalidateQueries({ queryKey: ["projectmail-messages"] }); qc.invalidateQueries({ queryKey: ["projectmail-scheduler"] }); };
  const act = async (k: string, fn: () => Promise<void>) => { setBusy(k); try { await fn(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); refresh(); } };
  const st = s.data;
  const connected = st?.connection_state === "verbonden";
  const sc = sched.data;
  const autoOn = !!(sc?.installed && sc.active && sc.armed && sc.enabled && connected);
  const autoLabel = !sc?.installed ? "Handmatig verwerken beschikbaar · automatische planning niet geïnstalleerd"
    : autoOn ? "Automatisch aan · elke 10 minuten" : connected ? "Automatische planning geïnstalleerd · uit" : "Automatische planning geïnstalleerd · uit tot verbinding geverifieerd";
  const title = (id: string | null) => projects.find((p) => p.id === id)?.title ?? "";

  return (
    <div className="space-y-4">
      <section className={`${surfaceCls} space-y-3 p-4`} aria-label="Projectmail">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="!font-sans text-lg font-semibold">Projectmail</h2>
            <p className="text-sm text-muted-foreground">Mail naar <span className="font-medium text-foreground">{st?.mailbox ?? PROJECTMAIL_MAILBOX}</span> met de projectcode tussen blokhaken in het onderwerp, bijvoorbeeld <code className="font-mono">[BCD-WORLDLINE]</code>. Alleen gecodeerde mails worden gelezen; mails blijven ongewijzigd in Outlook.</p>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Switch aria-label="Automatisch verwerken" checked={autoOn} disabled={!!busy || !sc?.installed || (!connected && !autoOn)} onCheckedChange={(v) => act("enable", async () => { const r = await setEnabled({ data: { enabled: v } }); if (!r.ok) toast.error(r.error); })} />
            Automatisch verwerken
          </label>
        </div>
        <div role="status" className={`flex items-start gap-2 rounded-md border p-3 text-sm ${connected ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/10"}`}>
          {connected ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-success-strong" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">{STATE[st?.connection_state ?? "onbekend"]}</p>
            <p className="text-muted-foreground">{autoLabel}</p>
            {st?.connection_detail && <p className="break-words text-muted-foreground">{st.connection_detail}</p>}
            <p className="text-xs text-muted-foreground tabular-nums">Gecontroleerd {fmt(st?.connection_checked_at)} · laatste geslaagde verwerking {fmt(st?.last_success_at)}</p>
            {st?.last_error && <p className="text-xs text-destructive break-words">Laatste fout ({fmt(st.last_error_at)}): {st.last_error}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => act("check", async () => { const r = await check(); (r.state === "verbonden" ? toast.success : toast.error)(r.detail); })}>
            {busy === "check" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Verbinding controleren
          </Button>
          <Button disabled={!!busy || !connected} onClick={() => act("run", async () => { const r = await runNow(); if (r.status === "ok") toast.success(`Verwerkt: ${r.counts?.processed ?? 0}, beoordeling: ${r.counts?.reviews ?? 0}, taken: ${r.counts?.tasks ?? 0}`); else if (r.status === "busy") toast.info("Er loopt al een verwerking"); else toast.error(r.error ?? "Mislukt"); })}>
            {busy === "run" && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Nu verwerken
          </Button>
        </div>
      </section>

      <section className={`${surfaceCls} space-y-2 p-4`} aria-label="Te beoordelen">
        <h3 className={sectionHeadCls}>Te beoordelen ({reviews.data?.length ?? 0})</h3>
        {!reviews.data?.length ? <p className="text-sm text-muted-foreground">Niets te beoordelen.</p> : (
          <ul className="space-y-2">
            {reviews.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-2 border-t border-border pt-2 text-sm first:border-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{REASON[r.reason] ?? r.reason}{r.project_id ? ` · ${title(r.project_id)}` : ""}</p>
                  <p className="break-words text-muted-foreground">{r.subject} · {fmt(r.received_at)}</p>
                  {r.detail?.titel && <p className="break-words">Taak: {String(r.detail.titel)}</p>}
                  {r.detail?.beschrijving && <p className="break-words">{String(r.detail.beschrijving)}</p>}
                  {r.detail?.bronzin && <p className="break-words text-xs text-muted-foreground">Bron: “{String(r.detail.bronzin)}”</p>}
                </div>
                {r.web_link && <Button size="sm" variant="ghost" asChild><a href={r.web_link} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => act(r.id, async () => { const { error } = await sb.rpc("projectmail_resolve_review", { _id: r.id }); if (error) throw error; })}>Afgehandeld</Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${surfaceCls} space-y-2 p-4`} aria-label="Projectcodes">
        <h3 className={sectionHeadCls}>Projectcodes</h3>
        <ul className="divide-y divide-border">
          {projects.map((p) => {
            const c = codes.data?.get(p.id);
            if (!c) return null;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{p.title}</span>
                <ProjectMailCode projectId={p.id} compact />
                <label className="flex min-h-10 items-center gap-2 text-xs text-muted-foreground">
                  <Switch checked={c.active} disabled={!!busy} onCheckedChange={(v) => act(p.id, async () => { const { error } = await sb.rpc("projectmail_set_active", { _project: p.id, _active: v }); if (error) throw error; })} />
                  {c.active ? "Actief" : "Pauze"}
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
