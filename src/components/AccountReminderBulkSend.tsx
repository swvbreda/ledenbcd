import { useEffect, useState } from "react";
import { Send, Users, Loader2 } from "lucide-react";
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
    let ok = 0;
    let fail = 0;
    for (const r of recipients) {
      try {
        const { error } = await supabase.functions.invoke("send-transactional-email", {
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
        ok++;
      } catch (err) {
        console.error("Send failed for", r.email, err);
        fail++;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setSending(false);
    if (fail === 0) toast.success(`${ok} mails verstuurd`);
    else toast.error(`${ok} verstuurd, ${fail} mislukt`);
  };

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
        </>
      )}
    </div>
  );
}
