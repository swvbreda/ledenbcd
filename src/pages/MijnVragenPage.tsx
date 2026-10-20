import { useEffect, useRef, useState } from "react";
import { ArrowLeft, HelpCircle, Plus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  uploadAttachments, useMemberProjects, useMyThreads, useMyWhatsAppLink, useSupportInvalidate,
} from "@/hooks/useSupport";
import SupportThreadView, { FilePicker, SupportStatusBadge } from "@/components/support/SupportThreadView";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBcdWhatsAppNumber } from "@/lib/bcdWhatsAppNumber.functions";
import { waDeepLink } from "@/lib/bcdWhatsAppNumber";

function NewQuestion({ onDone }: { onDone: (id: string) => void }) {
  const { user } = useAuth();
  const { data: projects } = useMemberProjects(user?.id, true);
  const invalidate = useSupportInvalidate();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [project, setProject] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || busy) return;
    if (subject.trim().length < 3 || !body.trim()) { toast.error("Vul een onderwerp (min. 3 tekens) en je vraag in"); return; }
    setBusy(true);
    try {
      const { data: threadId, error } = await supabase.rpc("support_create_thread", {
        p_subject: subject, p_body: body, p_project_id: project || null, p_client_key: key.current,
      } as never);
      if (error || !threadId) throw error ?? new Error("x");
      if (files.length) {
        const { data: msg } = await supabase.from("support_messages").select("id").eq("client_key", key.current).maybeSingle();
        const failed = msg ? await uploadAttachments(threadId as string, msg.id, user.id, files) : files.map((f) => f.name);
        if (failed.length) toast.error(`Niet geüpload: ${failed.join(", ")}`);
      }
      toast.success("Je vraag is verstuurd");
      invalidate();
      onDone(threadId as string);
    } catch {
      toast.error("Versturen mislukt");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="q-subject" className="text-xs font-medium">Onderwerp</label>
        <Input id="q-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} required />
      </div>
      <div className="space-y-1">
        <label htmlFor="q-body" className="text-xs font-medium">Je vraag</label>
        <Textarea id="q-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} rows={5} required />
      </div>
      <div className="space-y-1">
        <label htmlFor="q-project" className="text-xs font-medium">Gaat over project (optioneel)</label>
        <select id="q-project" value={project} onChange={(e) => setProject(e.target.value)}
          className="h-9 w-full max-w-full rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Geen project</option>
          {projects?.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </div>
      <FilePicker id="q-files" files={files} setFiles={setFiles} />
      <Button type="submit" disabled={busy}>Vraag versturen</Button>
    </form>
  );
}

function WhatsAppLinkCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Code lives only in component state; never persisted client-side.
  const [code, setCode] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: link, isLoading } = useMyWhatsAppLink(user?.id, true, waiting);
  const fetchNumber = useServerFn(getBcdWhatsAppNumber);
  const { data: number } = useQuery({
    queryKey: ["bcd-wa-number", user?.id],
    enabled: !!user?.id && !link,
    staleTime: 10 * 60_000,
    queryFn: () => fetchNumber(),
  });
  const bcd = number && "digits" in number ? number : null;

  useEffect(() => {
    if (waiting && link) { setWaiting(false); setCode(null); }
  }, [waiting, link]);
  useEffect(() => {
    if (!waiting) return;
    const t = setTimeout(() => setWaiting(false), 10 * 60_000);
    return () => clearTimeout(t);
  }, [waiting]);

  const createCode = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("support_wa_create_code");
    setBusy(false);
    if (error) { toast.error(error.message.includes("rate_limited") ? "Te veel codes aangevraagd; probeer het over een uur opnieuw" : "Code aanmaken mislukt"); return; }
    setCode(data as string);
    setWaiting(false);
  };
  const unlink = async () => {
    const { error } = await supabase.rpc("support_wa_unlink");
    if (error) toast.error("Ontkoppelen mislukt"); else { toast.success("WhatsApp ontkoppeld"); qc.invalidateQueries({ queryKey: ["support-wa-link"] }); }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2"><Smartphone size={16} className="text-brand-red" /> Vragen via WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {isLoading ? <p className="text-muted-foreground">Laden...</p> : link ? (
          <>
            <p>Je WhatsApp-nummer eindigend op <strong>{link.phone.slice(-3)}</strong> is gekoppeld. Nieuwe berichten die je naar het BCD-nummer stuurt, verschijnen hier bij je vragen. Oudere berichten worden niet overgenomen.</p>
            <Button variant="outline" size="sm" onClick={unlink}>Ontkoppelen</Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">Wil je ook via WhatsApp vragen stellen? Vraag een eenmalige code aan en stuur die zelf vanaf je eigen telefoon naar het BCD WhatsApp-nummer. De code is 10 minuten geldig.</p>
            {code ? (
              <div className="rounded-md border border-border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">
                  Stuur precies deze code naar het BCD WhatsApp-nummer{bcd ? <> <strong className="text-foreground tabular-nums">{bcd.display}</strong></> : null}:
                </p>
                <p className="font-mono text-lg tracking-wider select-all break-all">{code}</p>
                {bcd ? (
                  <a href={waDeepLink(bcd.digits, code)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-brand-red underline">
                    <Smartphone size={14} /> Open WhatsApp met deze code
                  </a>
                ) : number && "blocker" in number ? (
                  <p role="alert" className="text-xs text-destructive">Het BCD-nummer kan nu niet worden opgehaald ({number.blocker}). Probeer het later opnieuw.</p>
                ) : <p className="text-xs text-muted-foreground">BCD-nummer ophalen...</p>}
                {waiting ? (
                  <p role="status" className="text-xs text-muted-foreground">Wachten op ontvangst van je code... Nog niet gekoppeld. Dit kan even duren; deze melding werkt zichzelf bij.</p>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => { setWaiting(true); qc.invalidateQueries({ queryKey: ["support-wa-link"] }); }}>Ik heb de code verstuurd</Button>
                )}
              </div>
            ) : <Button variant="outline" size="sm" onClick={createCode} disabled={busy}>Koppelcode aanvragen</Button>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

const MijnVragenPage = () => {
  const { user, linkedMemberId, isExtern, isInhuur } = useAuth();
  const allowed = !!linkedMemberId && !isExtern && !isInhuur;
  const { data: threads, isLoading, error } = useMyThreads(user?.id, allowed);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const current = threads?.find((t) => t.id === selected) ?? null;

  if (!allowed) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <BcdHeroBanner title="Mijn vragen" subtitle="Stel je vraag aan BCD" />
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Mijn vragen is beschikbaar voor ingelogde leden met een gekoppeld lidmaatschap.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden">
      <BcdHeroBanner title="Mijn vragen" subtitle="Stel je vraag aan BCD" />
      {current ? (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
            <Button variant="ghost" size="sm" className="px-2" aria-label="Terug" onClick={() => setSelected(null)}><ArrowLeft size={16} /></Button>
            <CardTitle className="text-base break-words min-w-0">{current.subject}</CardTitle>
          </CardHeader>
          <CardContent><SupportThreadView key={current.id} thread={current} mode="member" /></CardContent>
        </Card>
      ) : creating ? (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
            <Button variant="ghost" size="sm" className="px-2" aria-label="Terug" onClick={() => setCreating(false)}><ArrowLeft size={16} /></Button>
            <CardTitle className="text-base">Stel een vraag</CardTitle>
          </CardHeader>
          <CardContent><NewQuestion onDone={(id) => { setCreating(false); setSelected(id); }} /></CardContent>
        </Card>
      ) : (
        <>
          <Button onClick={() => setCreating(true)} className="gap-1.5"><Plus size={16} /> Stel een vraag</Button>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><HelpCircle size={16} className="text-brand-red" /> Mijn gesprekken</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading && <p className="px-4 py-6 text-sm text-muted-foreground">Laden...</p>}
              {error && <p className="px-4 py-6 text-sm text-destructive">Vragen konden niet worden geladen.</p>}
              {!isLoading && !error && !threads?.length && <p className="px-4 py-6 text-sm text-muted-foreground">Je hebt nog geen vragen gesteld.</p>}
              <ul className="divide-y divide-border">
                {threads?.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setSelected(t.id)} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${t.member_unread ? "font-semibold" : "font-medium"}`}>{t.subject}</span>
                        <SupportStatusBadge status={t.status} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t.channel === "whatsapp" ? "Via WhatsApp · " : ""}{new Date(t.last_activity_at).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {t.member_unread ? " · Nieuw antwoord" : ""}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <WhatsAppLinkCard />
        </>
      )}
    </div>
  );
};

export default MijnVragenPage;
