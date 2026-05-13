import { useEffect, useState } from "react";
import { Send, Users, Loader2, Download, CheckCircle2, XCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

function pickEmail(data: any): string | null {
  const direct = (data?.email || "").toString().trim();
  if (direct && direct.includes("@")) return direct.toLowerCase();
  const contacten = Array.isArray(data?.contacten) ? data.contacten : [];
  for (const c of contacten) {
    const e = (c?.email || "").toString().trim();
    if (e && e.includes("@")) return e.toLowerCase();
  }
  return null;
}

function pickContactNaam(data: any): string {
  const direct = (data?.contactpersoon || "").toString().trim();
  if (direct) return direct;
  const contacten = Array.isArray(data?.contacten) ? data.contacten : [];
  for (const c of contacten) {
    const n = (c?.naam || "").toString().trim();
    if (n) return n;
  }
  return "lid";
}

export function AccountReminderBulkSend({ template }: { template: Tpl }) {
  const [loading, setLoading] = useState(true);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [mdRes, meRes, mpRes] = await Promise.all([
          supabase.from("members_data").select("id, data").eq("member_type", "member"),
          supabase.from("member_edits").select("member_id, data"),
          supabase.from("member_profiles").select("member_id"),
        ]);
        if (mdRes.error) throw mdRes.error;
        if (meRes.error) throw meRes.error;
        if (mpRes.error) throw mpRes.error;

        const editsMap = new Map<number, any>();
        (meRes.data || []).forEach((e: any) => editsMap.set(e.member_id, e.data));
        const withAccount = new Set<number>(
          (mpRes.data || []).map((p: any) => p.member_id),
        );

        const list: Recipient[] = [];
        const seenEmails = new Set<string>();
        for (const m of mdRes.data || []) {
          if (withAccount.has(m.id)) continue;
          const baseData = (m.data || {}) as Record<string, any>;
          const editData = (editsMap.get(m.id) || {}) as Record<string, any>;
          const merged: Record<string, any> = { ...baseData, ...editData };
          const email = pickEmail(merged);
          if (!email) continue;
          if (seenEmails.has(email)) continue;
          seenEmails.add(email);
          list.push({
            memberId: m.id,
            email,
            contactpersoon: pickContactNaam(merged),
            coffeeshop: (merged.naam || merged.bedrijfsnaam || "").toString(),
            plaats: (merged.plaats || "").toString(),
          });
        }
        list.sort((a, b) => a.coffeeshop.localeCompare(b.coffeeshop));
        setRecipients(list);
      } catch (err: any) {
        toast.error("Laden mislukt: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    for (const r of recipients) {
      let status: LogStatus = "verzonden";
      let message = "";
      try {
        const { data, error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "member-welcome",
            recipientEmail: r.email,
            idempotencyKey: `account-reminder-${r.memberId}`,
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
    a.download = `account-reminder-log-${stamp}.csv`;
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
        <Users size={16} className="text-primary" />
        <span className="font-medium">Bulk verzenden</span>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Ontvangers laden...
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground tabular-nums">{recipients.length}</strong>{" "}
            {recipients.length === 1 ? "lid" : "leden"} zonder account met een bekend e-mailadres.
            Eerst opslaan om de meest recente tekst te gebruiken.
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
                {sending ? "Versturen..." : `Verstuur naar ${recipients.length} leden`}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bulkverzending bevestigen</AlertDialogTitle>
                <AlertDialogDescription>
                  Je staat op het punt om de huidige "Herinnering account aanmaken" mail te
                  versturen naar {recipients.length} leden zonder account. Dit kan niet
                  ongedaan worden gemaakt.
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
