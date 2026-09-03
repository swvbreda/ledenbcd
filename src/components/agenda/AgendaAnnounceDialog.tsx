import { useEffect, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatEventDate, formatTimeRange, type AgendaEvent } from "@/hooks/useAgenda";

type Audience = "members_leads" | "members_all" | "members_with_account";

const AUDIENCE_LABELS: Record<Audience, string> = {
  members_leads: "Leden + leads",
  members_all: "Alle leden",
  members_with_account: "Alleen leden met account",
};

interface Recipient {
  memberId: number;
  email: string;
  naam: string;
}

const EMAIL_RE = /^[^\s@"'<>,;:]+@[^\s@"'<>,;:]+\.[^\s@"'<>,;:]{2,}$/;

function collectContactEmails(data: any): { email: string; naam: string }[] {
  const out: { email: string; naam: string }[] = [];
  const seen = new Set<string>();
  const push = (email?: string, naam?: string) => {
    const e = (email || "").toString().trim().toLowerCase();
    if (!e || !EMAIL_RE.test(e) || seen.has(e)) return;
    seen.add(e);
    out.push({ email: e, naam: (naam || "").toString().trim() || "lid" });
  };
  push(data?.email, data?.contactpersoon);
  const contacten = Array.isArray(data?.contacten) ? data.contacten : [];
  for (const c of contacten) push(c?.email, c?.naam);
  return out;
}

const PUBLIC_BASE_URL = "https://leden.coffeeshopbond.nl";

function announcementUrl(event: AgendaEvent) {
  return event.share_code
    ? `${PUBLIC_BASE_URL}/a/${event.share_code}`
    : `${PUBLIC_BASE_URL}/agenda/${event.id}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgendaEvent | null;
}

export default function AgendaAnnounceDialog({ open, onOpenChange, event }: Props) {
  const [audience, setAudience] = useState<Audience>("members_leads");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<
    { id: number; member_type: string; merged: any; hasAccount: boolean }[]
  >([]);
  const [intro, setIntro] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    if (!open || !event) return;
    setIntro(
      `Graag nodigen wij je uit voor ${event.title}. Meld je aan via de knop hieronder, dan weten wij op hoeveel personen we kunnen rekenen.`,
    );
    setProgress({ done: 0, total: 0 });
    (async () => {
      setLoading(true);
      try {
        const [mdRes, meRes, mpRes] = await Promise.all([
          supabase.from("members_data").select("id, member_type, data"),
          supabase.from("member_edits").select("member_id, data"),
          supabase.from("member_profiles").select("member_id"),
        ]);
        if (mdRes.error) throw mdRes.error;
        const edits = new Map<number, any>();
        for (const e of meRes.data || []) edits.set((e as any).member_id, (e as any).data);
        const withAccount = new Set<number>(
          (mpRes.data || []).map((p: any) => p.member_id as number),
        );
        setRows(
          (mdRes.data || []).map((m: any) => ({
            id: m.id,
            member_type: m.member_type,
            merged: { ...(m.data || {}), ...(edits.get(m.id) || {}) },
            hasAccount: withAccount.has(m.id),
          })),
        );
      } catch (err: any) {
        toast.error("Ontvangers laden mislukt: " + (err?.message || ""));
      } finally {
        setLoading(false);
      }
    })();
  }, [open, event?.id]);

  const recipients = useMemo<Recipient[]>(() => {
    const filtered = rows.filter((m) => {
      switch (audience) {
        case "members_leads":
          return m.member_type === "member" || m.member_type === "lead";
        case "members_all":
          return m.member_type === "member";
        case "members_with_account":
          return m.member_type === "member" && m.hasAccount;
      }
    });
    const list: Recipient[] = [];
    const seen = new Set<string>();
    for (const m of filtered) {
      for (const c of collectContactEmails(m.merged)) {
        if (seen.has(c.email)) continue;
        seen.add(c.email);
        list.push({ memberId: m.id, email: c.email, naam: c.naam });
      }
    }
    return list;
  }, [rows, audience]);

  const send = async () => {
    if (!event) return;
    setSending(true);
    setProgress({ done: 0, total: recipients.length });
    let ok = 0;
    let refused = 0;
    let fail = 0;
    const templateData = {
      eventTitle: event.title,
      eventDate: formatEventDate(event.event_date),
      eventTime: formatTimeRange(event.start_time, event.end_time),
      location: event.location ?? "",
      description: event.description ?? "",
      intro: intro.trim(),
      eventUrl: announcementUrl(event),
    };
    for (const r of recipients) {
      try {
        const { data, error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "agenda-event-announcement",
            recipientEmail: r.email,
            idempotencyKey: `agenda-announce-${event.id}-${r.email}`,
            templateData: { ...templateData, recipientName: r.naam },
          },
        });
        if (error) throw error;
        if (data && (data as any).success === false) refused++;
        else ok++;
      } catch (err) {
        console.error("Aankondiging mislukt voor", r.email, err);
        fail++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSending(false);
    const summary = `${ok} verzonden, ${refused} geweigerd, ${fail} fout`;
    if (fail === 0 && refused === 0) toast.success(summary);
    else if (fail === 0) toast.warning(summary);
    else toast.error(summary);
    if (fail === 0) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!sending ? onOpenChange(v) : null)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Evenement aankondigen</DialogTitle>
          <DialogDescription>
            Stuur een uitnodiging per e-mail. Er wordt niets verstuurd tot je op Versturen klikt.
          </DialogDescription>
        </DialogHeader>

        {event && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p className="font-semibold">{event.title}</p>
              <p className="text-muted-foreground">
                {formatEventDate(event.event_date)}
                {formatTimeRange(event.start_time, event.end_time)
                  ? ` · ${formatTimeRange(event.start_time, event.end_time)}`
                  : ""}
                {event.location ? ` · ${event.location}` : ""}
              </p>
            </div>

            <div>
              <Label>Ontvangers</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
                    <SelectItem key={a} value={a}>
                      {AUDIENCE_LABELS[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {loading
                  ? "Ontvangers laden…"
                  : `${recipients.length} unieke e-mailadressen`}
              </p>
            </div>

            <div>
              <Label htmlFor="ag-intro">Begeleidende tekst</Label>
              <Textarea
                id="ag-intro"
                rows={5}
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
              />
            </div>

            {sending && (
              <div className="space-y-1">
                <Progress
                  value={progress.total ? (progress.done / progress.total) * 100 : 0}
                />
                <p className="text-xs text-muted-foreground">
                  {progress.done} / {progress.total} verstuurd
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={sending} onClick={() => onOpenChange(false)}>
            Niet nu
          </Button>
          <Button onClick={send} disabled={sending || loading || recipients.length === 0}>
            {sending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            Versturen ({recipients.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
