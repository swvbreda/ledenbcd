import { useEffect, useRef, useState } from "react";
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
} from "@/lib/agendaParticipantMail.functions";
import type { MailReport, RecipientResult } from "@/lib/agendaParticipantMail";
import type { AgendaEvent } from "@/hooks/useAgenda";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: AgendaEvent;
}

const SOURCE_LABEL = { lid: "lid", bestuur: "bestuur", gast: "gast", aanmelding: "aanmelding" } as const;

export default function AgendaParticipantMailDialog({ open, onOpenChange, event }: Props) {
  const preview = useServerFn(previewParticipantMail);
  const send = useServerFn(sendParticipantMail);
  const [data, setData] = useState<RecipientResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<MailReport | null>(null);
  // Eén id per nieuw bericht: retry/dubbelklik hergebruikt hem, een nieuw bericht niet.
  const batchId = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    batchId.current = crypto.randomUUID();
    setSubject(`Bericht over ${event.title}`);
    setBody("");
    setConfirm(false);
    setReport(null);
    setData(null);
    setLoading(true);
    preview({ data: { eventId: event.id } })
      .then(setData)
      .catch((e: any) => toast.error(e?.message || "Ontvangers laden mislukt"))
      .finally(() => setLoading(false));
  }, [open, event.id]);

  const locked = !!report; // na eerste poging: bericht vast, alleen hervatten
  const doSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const r = await send({
        data: { eventId: event.id, batchId: batchId.current, subject, body },
      });
      setReport(r);
      const msg = `${r.sent} verzonden, ${r.skipped} overgeslagen, ${r.failed} mislukt${
        r.alreadyDone ? `, ${r.alreadyDone} al eerder verzonden` : ""
      }`;
      if (r.failed || r.inProgress) toast.warning(msg);
      else toast.success(msg);
    } catch (e: any) {
      toast.error(e?.message || "Versturen mislukt");
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
            {loading ? (
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
                          {m.reason === "missing" ? "geen e-mailadres" : `ongeldig adres: ${m.value}`}
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

          {report && (
            <div className="rounded-md border border-border p-3 text-sm tabular-nums">
              <p>Verzonden: {report.sent}</p>
              <p>Overgeslagen (afgemeld/geblokkeerd): {report.skipped}</p>
              <p>Al eerder verzonden in deze ronde: {report.alreadyDone}</p>
              {report.inProgress > 0 && <p>Nog bezig: {report.inProgress}</p>}
              <p className={report.failedEmails.length ? "text-destructive" : ""}>
                Mislukt: {report.failedEmails.length}
              </p>
            </div>
          )}

          {!report && (
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
          {report ? (
            report.failedEmails.length > 0 && (
              <Button onClick={doSend} disabled={sending}>
                {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                Alleen mislukte opnieuw ({report.failedEmails.length})
              </Button>
            )
          ) : (
            <Button onClick={doSend}
              disabled={sending || loading || !confirm || count === 0 || !subject.trim() || !body.trim()}>
              {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Versturen ({count})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
