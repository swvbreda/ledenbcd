import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  previewParticipantMail,
  sendParticipantMail,
  getParticipantMailStatus,
} from "@/lib/agendaParticipantMail.functions";
import type { MailReport, RecipientResult } from "@/lib/agendaParticipantMail";
import type { AgendaEvent } from "@/hooks/useAgenda";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: AgendaEvent;
}

const SOURCE_LABEL = { lid: "lid", bestuur: "bestuur", gast: "gast", aanmelding: "aanmelding" } as const;

type Attempt = { batchId: string; subject: string; body: string };
type StatusRow = MailReport["rows"][number];
const storeKey = (eventId: string) => `bcd-participant-mail:${eventId}`;
const loadAttempt = (eventId: string): Attempt | null => {
  try {
    const v = JSON.parse(localStorage.getItem(storeKey(eventId)) ?? "null");
    return v && typeof v.batchId === "string" ? v : null;
  } catch {
    return null;
  }
};
const STATUS_LABEL: Record<StatusRow["status"], string> = {
  pending: "wacht",
  claimed: "bezig/onbekend",
  sent: "verzonden",
  accepted: "aangenomen, niet bevestigd",
  skipped: "overgeslagen",
  failed: "mislukt",
  uncertain: "onzeker (mogelijk aangekomen)",
};

export default function AgendaParticipantMailDialog({ open, onOpenChange, event }: Props) {
  const preview = useServerFn(previewParticipantMail);
  const send = useServerFn(sendParticipantMail);
  const getStatus = useServerFn(getParticipantMailStatus);
  const [data, setData] = useState<RecipientResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  // Poging blijft bewaard (ook na sluiten/netwerkfout); alleen "Nieuw bericht" maakt een nieuwe.
  const [attempt, setAttempt] = useState<Attempt | null>(null);

  const saveAttempt = (a: Attempt | null) => {
    setAttempt(a);
    if (a) localStorage.setItem(storeKey(event.id), JSON.stringify(a));
    else localStorage.removeItem(storeKey(event.id));
  };

  const loadPreview = () => {
    setLoading(true);
    setData(null);
    preview({ data: { eventId: event.id } })
      .then(setData)
      .catch((e: any) => toast.error(e?.message || "Ontvangers laden mislukt"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setConfirm(false);
    setRows(null);
    const a = loadAttempt(event.id);
    setAttempt(a);
    if (a) {
      setSubject(a.subject);
      setBody(a.body);
      getStatus({ data: { eventId: event.id, batchId: a.batchId } })
        .then((st) => {
          if (st) {
            setSubject(st.subject);
            setBody(st.body);
            setRows(st.rows);
          }
        })
        .catch((e: any) => toast.error(e?.message || "Status laden mislukt"));
    } else {
      setSubject(`Bericht over ${event.title}`);
      setBody("");
    }
    loadPreview();
  }, [open, event.id]);

  const newMessage = () => {
    saveAttempt(null);
    setRows(null);
    setConfirm(false);
    setSubject(`Bericht over ${event.title}`);
    setBody("");
    loadPreview();
  };

  const locked = !!attempt;
  const failedCount = rows?.filter((r) => r.status === "failed" || r.status === "pending").length ?? 0;
  const doSend = async () => {
    if (sending) return;
    setSending(true);
    const a = attempt ?? { batchId: crypto.randomUUID(), subject, body };
    saveAttempt(a); // vóór het netwerkverzoek: bij fout/sluiten wordt dezelfde batch hervat
    try {
      const r = await send({
        data: {
          eventId: event.id,
          batchId: a.batchId,
          subject: a.subject,
          body: a.body,
          expectedEmails: data?.recipients.map((x) => x.email),
        },
      });
      setRows(r.rows);
      setSubject(r.subject);
      setBody(r.body);
      saveAttempt({ batchId: r.batchId, subject: r.subject, body: r.body });
      const msg = `${r.sent} verzonden, ${r.accepted} aangenomen (niet bevestigd), ${r.skipped} overgeslagen, ${r.failed} mislukt, ${r.uncertain} onzeker`;
      if (r.failed || r.uncertain || r.inProgress || r.accepted) toast.warning(msg);
      else toast.success(msg);
      if (r.noLongerParticipant.length)
        toast.info(`${r.noLongerParticipant.length} oorspronkelijke ontvanger(s) zijn geen deelnemer meer en krijgen niets.`);
    } catch (e: any) {
      toast.error(e?.message || "Versturen mislukt");
      // Als nog geen batch is vastgelegd (bv. deelnemerslijst gewijzigd), mag de tekst weer bewerkt worden.
      const st = await getStatus({ data: { eventId: event.id, batchId: a.batchId } }).catch(() => undefined);
      if (st === null) {
        saveAttempt(null);
        loadPreview();
      } else if (st) setRows(st.rows);
    } finally {
      setSending(false);
    }
  };

  const count = data?.recipients.length ?? 0;
  return (
    <Dialog open={open} onOpenChange={(v) => (!sending ? onOpenChange(v) : null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mail alle deelnemers</DialogTitle>
          <DialogDescription>
            Iedere deelnemer krijgt een eigen mail; ontvangers zien elkaars adres niet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="pm-subject">Onderwerp</Label>
            <Input id="pm-subject" maxLength={200} value={subject} disabled={locked}
              onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pm-body">Bericht</Label>
            <Textarea id="pm-body" rows={7} maxLength={10000} value={body} disabled={locked}
              onChange={(e) => setBody(e.target.value)} />
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            {rows ? (
              <>
                <p className="font-semibold">Ontvangers van deze verzending (vastgelegd bij versturen)</p>
                <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-xs">
                  {rows.map((r) => (
                    <li key={r.email} className="flex justify-between gap-2">
                      <span className="truncate">{r.naam ?? "deelnemer"} · {r.email}</span>
                      <span className={`shrink-0 ${r.status === "failed" || r.status === "uncertain" ? "text-destructive" : "text-muted-foreground"}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Later aangemelde deelnemers vallen buiten deze verzending; afgemelde ontvangers worden overgeslagen.
                </p>
              </>
            ) : loading ? (
              <p className="text-muted-foreground">Ontvangers laden…</p>
            ) : data ? (
              <>
                <p className="font-semibold tabular-nums">{count} ontvanger{count === 1 ? "" : "s"}</p>
                <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {data.recipients.map((r) => (
                    <li key={r.email} className="flex justify-between gap-2">
                      <span className="truncate">{r.naam} · {r.email}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {r.sources.map((s) => SOURCE_LABEL[s]).join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
                {data.missing.length > 0 && (
                  <div className="mt-3 text-xs text-destructive">
                    <p className="font-semibold">Geen mail mogelijk ({data.missing.length}):</p>
                    <ul>
                      {data.missing.map((m, i) => (
                        <li key={i}>
                          {m.naam} ({SOURCE_LABEL[m.source]}) —{" "}
                          {m.reason === "missing"
                            ? "geen e-mailadres"
                            : m.reason === "ambiguous"
                              ? `meerdere contactadressen (${m.value}); vul het adres bij de aanmelding in`
                              : `ongeldig adres: ${m.value}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {data.excluded > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.excluded} geweigerde/afgemelde gast{data.excluded === 1 ? "" : "en"} niet meegenomen.
                  </p>
                )}
              </>
            ) : null}
          </div>

          {!attempt && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
              <span>Ik bevestig dat dit bericht naar {count} deelnemer{count === 1 ? "" : "s"} van dit evenement gaat.</span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>
            Sluiten
          </Button>
          {attempt ? (
            <>
              <Button variant="outline" disabled={sending} onClick={newMessage}>Nieuw bericht</Button>
              {(!rows || failedCount > 0) && (
                <Button onClick={doSend} disabled={sending}>
                  {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                  {rows ? `Alleen mislukte opnieuw (${failedCount})` : "Verzending hervatten"}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={doSend}
              disabled={sending || loading || !data || !confirm || count === 0 || !subject.trim() || !body.trim()}>
              {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Versturen ({count})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
