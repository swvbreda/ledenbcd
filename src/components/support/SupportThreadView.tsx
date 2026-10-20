import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  openSupportAttachment, uploadAttachments, useMarkSupportRead, useSupportInvalidate, useThreadDetail, type SupportThread,
} from "@/hooks/useSupport";
import {
  MAX_ATTACHMENTS, SUPPORT_STATUS_LABELS, WA_STATUS_LABELS, validateAttachment,
} from "@/lib/supportWhatsApp";
import { sendSupportWhatsAppReply } from "@/lib/supportWhatsApp.functions";

function fmt(v: string) {
  return new Date(v).toLocaleString("nl-NL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function SupportStatusBadge({ status }: { status: string }) {
  return <Badge variant={status === "afgerond" ? "secondary" : "outline"} className="text-[10px]">{SUPPORT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function FilePicker({ files, setFiles, id }: { files: File[]; setFiles: (f: File[]) => void; id: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
        <Paperclip size={14} className="text-brand-red" /> Bijlage (PDF/JPG/PNG, max 10 MB, max {MAX_ATTACHMENTS})
      </label>
      <input
        id={id} type="file" multiple accept="application/pdf,image/jpeg,image/png"
        className="block w-full max-w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-background file:px-2 file:py-1"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          const errors = picked.map(validateAttachment).filter(Boolean);
          if (errors.length) toast.error(errors.join("\n"));
          const ok = picked.filter((f) => !validateAttachment(f)).slice(0, MAX_ATTACHMENTS);
          setFiles(ok);
          if (!ok.length) e.target.value = "";
        }}
      />
      {files.length > 0 && <p className="text-xs text-muted-foreground break-words">{files.map((f) => f.name).join(", ")}</p>}
    </div>
  );
}

/** Mints a 60s signed URL only after an explicit click, then shows a normal link (no window.open). */
export function AttachmentItem({ path, name, open = openSupportAttachment }: { path: string; name: string; open?: (p: string) => Promise<string | null> }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    if (!url) return;
    const t = setTimeout(() => setUrl(null), 55_000);
    return () => clearTimeout(t);
  }, [url]);
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-brand-red underline break-all">
        <Paperclip size={12} /> Open {name}
      </a>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        disabled={state === "loading"}
        onClick={async () => {
          setState("loading");
          const u = await open(path).catch(() => null);
          if (u) { setUrl(u); setState("idle"); } else setState("error");
        }}
        className="inline-flex items-center gap-1 text-brand-red underline break-all text-left"
      >
        <Paperclip size={12} /> {state === "loading" ? "Ophalen..." : `Bijlage ophalen: ${name}`}
      </button>
      {state === "error" && <span role="alert" className="text-destructive">Bijlage niet beschikbaar.</span>}
    </div>
  );
}

export const WA_TRANSPORT_UNKNOWN =
  "Onbekend of het WhatsApp-bericht is verstuurd. Controleer de status in het gesprek; opnieuw proberen gebruikt dezelfde verzending en verstuurt niet dubbel.";

export default function SupportThreadView({ thread, mode }: { thread: SupportThread; mode: "member" | "admin" }) {
  const { user } = useAuth();
  const { data, isLoading, error } = useThreadDetail(user?.id, thread.id);
  const markRead = useMarkSupportRead();
  const invalidate = useSupportInvalidate();
  const sendWa = useServerFn(sendSupportWhatsAppReply);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [waNotice, setWaNotice] = useState<string | null>(null);
  const keyRef = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    const unread = mode === "admin" ? thread.admin_unread : thread.member_unread;
    if (unread) markRead.mutate(thread.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);

  const reset = () => { setBody(""); setFiles([]); setWaNotice(null); keyRef.current = crypto.randomUUID(); };

  const sendApp = async () => {
    if (!user || !body.trim() || busy) return;
    setBusy(true);
    try {
      const fn = mode === "admin" ? "support_admin_reply" : "support_member_reply";
      const { data: msgId, error: e } = await supabase.rpc(fn, { p_thread: thread.id, p_body: body, p_client_key: keyRef.current });
      if (e || !msgId) throw e ?? new Error("x");
      const failed = files.length ? await uploadAttachments(thread.id, msgId as string, user.id, files) : [];
      if (failed.length) toast.error(`Niet geüpload: ${failed.join(", ")}`);
      toast.success(mode === "admin" ? "Antwoord geplaatst in de app (niet via WhatsApp)" : "Reactie verstuurd");
      reset();
      invalidate();
    } catch {
      toast.error("Versturen mislukt");
    } finally { setBusy(false); }
  };

  const sendWhatsApp = async () => {
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      const res = await sendWa({ data: { threadId: thread.id, body, clientKey: keyRef.current } });
      if (res.state === "outside_window") {
        toast.error("Buiten het 24-uursvenster: alleen een door Meta goedgekeurd sjabloon is toegestaan. Er is niets verstuurd.");
      } else if (res.state === "no_link") {
        toast.error("Geen actieve WhatsApp-koppeling voor dit lid. Er is niets verstuurd.");
      } else {
        const label = WA_STATUS_LABELS[res.state] ?? res.state;
        if (res.state === "queued" || res.state === "sent") toast.success(`WhatsApp: ${label}`);
        else toast.error(`WhatsApp: ${label}${"error" in res && res.error ? ` — ${res.error}` : ""}`);
        reset();
      }
      invalidate();
    } catch {
      // Transport failure: the server may already have reserved/sent. Keep body + clientKey so a retry
      // returns the existing reservation (no second POST), and never claim nothing was sent.
      setWaNotice(WA_TRANSPORT_UNKNOWN);
      toast.error(WA_TRANSPORT_UNKNOWN);
      invalidate();
    } finally { setBusy(false); }
  };

  const setStatus = async (status: string) => {
    const { error: e } = await supabase.rpc("support_admin_set_status", { p_thread: thread.id, p_status: status });
    if (e) toast.error("Status wijzigen mislukt"); else invalidate();
  };

  return (
    <div className="space-y-3 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <SupportStatusBadge status={thread.status} />
        <Badge variant="outline" className="text-[10px] gap-1">
          {thread.channel === "whatsapp" ? <Smartphone size={10} /> : <MessageCircle size={10} />}
          {thread.channel === "whatsapp" ? "WhatsApp" : "App"}
        </Badge>
        {mode === "admin" && (
          <select
            aria-label="Status"
            value={thread.status}
            onChange={(e) => setStatus(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {Object.entries(SUPPORT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Laden...</p>}
      {error && <p className="text-sm text-destructive">Gesprek kon niet worden geladen.</p>}
      <ul className="space-y-2">
        {data?.messages.map((m) => {
          const atts = data.attachments.filter((a) => a.message_id === m.id);
          const mine = (mode === "admin") === (m.author_kind === "admin");
          return (
            <li key={m.id} className={`rounded-lg border p-3 space-y-1 max-w-full ${mine ? "border-primary/30 bg-primary/5" : "border-border"}`}>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{m.author_kind === "admin" ? "BCD" : mode === "admin" ? "Lid" : "Jij"}</span>
                <span>{m.channel === "whatsapp" ? (m.author_kind === "admin" ? "· WhatsApp-bericht" : "· via WhatsApp") : (m.author_kind === "admin" ? "· antwoord in app" : "")}</span>
                <span>{fmt(m.sent_at)}</span>
                {m.wa_status && m.author_kind === "admin" && (
                  <Badge variant={m.wa_status === "failed" || m.wa_status === "unknown" ? "destructive" : "secondary"} className="text-[10px]">
                    {WA_STATUS_LABELS[m.wa_status] ?? m.wa_status}
                  </Badge>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              {mode === "admin" && m.wa_error && <p className="text-xs text-destructive break-words">{m.wa_error}</p>}
              {atts.map((a) => <AttachmentItem key={a.id} path={a.path} name={a.file_name} />)}
            </li>
          );
        })}
      </ul>
      <div className="space-y-2">
          <label htmlFor={`reply-${thread.id}`} className="text-xs font-medium">{mode === "admin" ? "Antwoord" : "Reageren"}</label>
          <Textarea id={`reply-${thread.id}`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} rows={3} />
          <FilePicker id={`files-${thread.id}`} files={files} setFiles={setFiles} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={sendApp} disabled={busy || !body.trim()} className="gap-1.5">
              <Send size={14} /> {mode === "admin" ? "Antwoord in app" : "Versturen"}
            </Button>
            {mode === "admin" && thread.channel === "whatsapp" && (
              <Button size="sm" variant="outline" onClick={sendWhatsApp} disabled={busy || !body.trim() || !thread.link_active || files.length > 0} className="gap-1.5">
                <Smartphone size={14} /> Verstuur als WhatsApp-bericht
              </Button>
            )}
          </div>
          {waNotice && <p role="alert" className="text-xs text-destructive">{waNotice}</p>}
          {mode === "admin" && thread.channel === "whatsapp" && (
            <p className="text-xs text-muted-foreground">
              Een WhatsApp-bericht gaat echt naar het lid en kan alleen binnen 24 uur na het laatste bericht van het lid. Bijlagen gaan alleen via de app.
              {!thread.link_active && " Deze koppeling is niet meer actief."}
            </p>
          )}
        </div>
    </div>
  );
}
