import { useEffect, useMemo, useState } from "react";
import { Send, Users, Loader2, Download, CheckCircle2, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Audience =
  | "members_no_account"
  | "members_with_account"
  | "members_all"
  | "leads"
  | "old";

const AUDIENCE_LABELS: Record<Audience, string> = {
  members_no_account: "Leden zonder account",
  members_with_account: "Leden met account",
  members_all: "Alle leden",
  leads: "Leads",
  old: "Oud-leden",
};

type Recipient = {
  memberId: number;
  email: string;
  contactpersoon: string;
  coffeeshop: string;
  plaats: string;
};

type Tpl = { subject: string; body: string };

type LogStatus = "verzonden" | "fout" | "geweigerd";
type LogEntry = {
  memberId: number;
  email: string;
  contactpersoon: string;
  coffeeshop: string;
  status: LogStatus;
  message: string;
  at: string;
};

// Strikte e-mailvalidatie: voorkomt dat Resend 422 geeft op rommelige adressen
// (spaties, ontbrekend domein, dubbele @, etc.).
const EMAIL_RE = /^[^\s@"'<>,;:]+@[^\s@"'<>,;:]+\.[^\s@"'<>,;:]{2,}$/;
function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}
function collectContactEmails(data: any): { email: string; naam: string }[] {
  const out: { email: string; naam: string }[] = [];
  const seen = new Set<string>();
  const push = (email?: string, naam?: string) => {
    const e = (email || "").toString().trim().toLowerCase();
    if (!e || !isValidEmail(e) || seen.has(e)) return;
    seen.add(e);
    out.push({ email: e, naam: (naam || "").toString().trim() || "lid" });
  };
  push(data?.email, data?.contactpersoon);
  const contacten = Array.isArray(data?.contacten) ? data.contacten : [];
  for (const c of contacten) push(c?.email, c?.naam);
  return out;
}

export function BulkEmailSend({
  templateKey,
  template,
  defaultAudience = "members_no_account",
}: {
  templateKey: string;
  template: Tpl;
  defaultAudience?: Audience;
}) {
  const [audience, setAudience] = useState<Audience>(defaultAudience);
  const [loading, setLoading] = useState(true);
  const [allMembers, setAllMembers] = useState<
    { id: number; member_type: string; merged: any; hasAccount: boolean }[]
  >([]);
  const [alreadySent, setAlreadySent] = useState<Set<string>>(new Set());
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [mdRes, meRes, mpRes, logRes] = await Promise.all([
          supabase.from("members_data").select("id, member_type, data"),
          supabase.from("member_edits").select("member_id, data"),
          supabase.from("member_profiles").select("member_id"),
          supabase
            .from("email_send_log")
            .select("recipient_email")
            .eq("template_name", "member-welcome")
            .eq("status", "sent"),
        ]);
        if (mdRes.error) throw mdRes.error;
        if (meRes.error) throw meRes.error;
        if (mpRes.error) throw mpRes.error;
        if (logRes.error) throw logRes.error;
        setAlreadySent(
          new Set(
            (logRes.data || [])
              .map((r: any) => (r.recipient_email || "").toString().trim().toLowerCase())
              .filter(Boolean),
          ),
        );

        const editsMap = new Map<number, any>();
        (meRes.data || []).forEach((e: any) => editsMap.set(e.member_id, e.data));
        const withAccount = new Set<number>(
          (mpRes.data || []).map((p: any) => p.member_id),
        );

        const list = (mdRes.data || []).map((m: any) => ({
          id: m.id,
          member_type: m.member_type,
          merged: { ...(m.data || {}), ...(editsMap.get(m.id) || {}) },
          hasAccount: withAccount.has(m.id),
        }));
        setAllMembers(list);
      } catch (err: any) {
        toast.error("Laden mislukt: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recipients = useMemo<Recipient[]>(() => {
    const filtered = allMembers.filter((m) => {
      switch (audience) {
        case "members_no_account":
          return m.member_type === "member" && !m.hasAccount;
        case "members_with_account":
          return m.member_type === "member" && m.hasAccount;
        case "members_all":
          return m.member_type === "member";
        case "leads":
          return m.member_type === "lead";
        case "old":
          return m.member_type === "old";
      }
    });
    const list: Recipient[] = [];
    const seen = new Set<string>();
    for (const m of filtered) {
      const coffeeshop = (m.merged.naam || m.merged.bedrijfsnaam || "").toString();
      const plaats = (m.merged.plaats || "").toString();
      for (const c of collectContactEmails(m.merged)) {
        if (seen.has(c.email)) continue;
        if (skipAlreadySent && alreadySent.has(c.email)) continue;
        seen.add(c.email);
        list.push({
          memberId: m.id,
          email: c.email,
          contactpersoon: c.naam,
          coffeeshop,
          plaats,
        });
      }
    }
    list.sort((a, b) => a.coffeeshop.localeCompare(b.coffeeshop));
    return list;
  }, [allMembers, audience, alreadySent, skipAlreadySent]);

  const fill = (s: string, r: Recipient) =>
    s
      .split("{{contactpersoon}}").join(r.contactpersoon)
      .split("{{coffeeshop}}").join(r.coffeeshop)
      .split("{{plaats}}").join(r.plaats);

  const sendAll = async () => {
    setSending(true);
    setProgress({ done: 0, total: recipients.length });
    setLog([]);
    let ok = 0;
    let fail = 0;
    let refused = 0;
    const entries: LogEntry[] = [];
    const stamp = Date.now();
    for (const r of recipients) {
      let status: LogStatus = "verzonden";
      let message = "";
      try {
        const { data, error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "member-welcome",
            recipientEmail: r.email,
            idempotencyKey: `${templateKey}-${audience}-${stamp}-${r.memberId}`,
            templateData: {
              subject: fill(template.subject, r),
              body: fill(template.body, r),
            },
          },
        });
        if (error) throw error;
        if (data && data.success === false) {
          status = "geweigerd";
          message = (data.reason || "geweigerd").toString();
          refused++;
        } else {
          ok++;
        }
      } catch (err) {
        console.error("Send failed for", r.email, err);
        status = "fout";
        message = err instanceof Error ? err.message : String(err);
        fail++;
      }
      entries.push({
        memberId: r.memberId,
        email: r.email,
        contactpersoon: r.contactpersoon,
        coffeeshop: r.coffeeshop,
        status,
        message,
        at: new Date().toISOString(),
      });
      setLog([...entries]);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSending(false);
    const summary = `${ok} verzonden, ${refused} geweigerd, ${fail} fout`;
    if (fail === 0 && refused === 0) toast.success(summary);
    else if (fail === 0) toast.warning(summary);
    else toast.error(summary);
  };

  const downloadCsv = () => {
    const header = ["lidnummer", "coffeeshop", "contactpersoon", "email", "status", "bericht", "tijdstip"];
    const escape = (v: string) => {
      const s = (v ?? "").toString();
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = log.map((e) =>
      [String(e.memberId), e.coffeeshop, e.contactpersoon, e.email, e.status, e.message, e.at]
        .map(escape)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    a.href = url;
    a.download = `${templateKey}-log-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const counts = log.reduce(
    (acc, e) => {
      acc[e.status]++;
      return acc;
    },
    { verzonden: 0, fout: 0, geweigerd: 0 } as Record<LogStatus, number>,
  );

  return (
    <div className="rounded-md border-2 border-primary/60 bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Users size={16} className="text-brand-red" />
        <span className="font-medium">Bulk verzenden</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Ontvangers laden...
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-xs">Doelgroep</Label>
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
            </div>
            <p className="text-sm text-muted-foreground pb-2">
              <strong className="text-foreground tabular-nums">{recipients.length}</strong>{" "}
              ontvanger{recipients.length === 1 ? "" : "s"} met e-mailadres
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={skipAlreadySent}
              onCheckedChange={(v) => setSkipAlreadySent(v === true)}
            />
            <span>
              Sla ontvangers over die al een uitnodiging kregen
              {alreadySent.size > 0 && (
                <span className="tabular-nums"> ({alreadySent.size} eerder verzonden)</span>
              )}
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Sla eerst op om de meest recente tekst te gebruiken. Eén mail per uniek e-mailadres.
          </p>
          {sending && (
            <div className="space-y-1">
              <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground tabular-nums">
                {progress.done} / {progress.total}
              </p>
            </div>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                disabled={sending || recipients.length === 0}
                className="gap-1.5"
              >
                <Send size={14} />
                {sending ? "Versturen..." : `Verstuur naar ${recipients.length} ontvangers`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bulkverzending bevestigen</AlertDialogTitle>
                <AlertDialogDescription>
                  Je staat op het punt om deze mail te versturen naar{" "}
                  {recipients.length} ontvangers ({AUDIENCE_LABELS[audience].toLowerCase()}).
                  Dit kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction onClick={sendAll}>Versturen</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {log.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-primary/30">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 size={12} />
                    <span className="tabular-nums">{counts.verzonden}</span> verzonden
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Ban size={12} />
                    <span className="tabular-nums">{counts.geweigerd}</span> geweigerd
                  </span>
                  <span className="inline-flex items-center gap-1 text-destructive">
                    <XCircle size={12} />
                    <span className="tabular-nums">{counts.fout}</span> fout
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={downloadCsv} className="gap-1.5">
                  <Download size={14} /> CSV
                </Button>
              </div>
              <div className="max-h-64 overflow-auto rounded border bg-background">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-medium">Status</th>
                      <th className="px-2 py-1.5 font-medium">Coffeeshop</th>
                      <th className="px-2 py-1.5 font-medium">E-mail</th>
                      <th className="px-2 py-1.5 font-medium">Bericht</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">
                          {e.status === "verzonden" && (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <CheckCircle2 size={12} /> verzonden
                            </span>
                          )}
                          {e.status === "geweigerd" && (
                            <span className="inline-flex items-center gap-1 text-amber-700">
                              <Ban size={12} /> geweigerd
                            </span>
                          )}
                          {e.status === "fout" && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <XCircle size={12} /> fout
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1">{e.coffeeshop}</td>
                        <td className="px-2 py-1">{e.email}</td>
                        <td className="px-2 py-1 text-muted-foreground">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
