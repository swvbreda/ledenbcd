import { useEffect, useState } from "react";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useAuth } from "@/hooks/useAuth";
import { BulkEmailSend } from "@/components/BulkEmailSend";
import { EmailSendLog } from "@/components/EmailSendLog";

type Tpl = { key: string; subject: string; body: string };

const TEMPLATE_LABELS: Record<string, { title: string; description: string }> = {
  member_welcome: {
    title: "Welkomstmail nieuw lid",
    description: "Wordt verstuurd wanneer een nieuw lid wordt toegevoegd.",
  },
  lead_welcome: {
    title: "Uitnodigingsmail lead",
    description: "Wordt verstuurd wanneer een nieuwe lead wordt toegevoegd.",
  },
  login_reminder: {
    title: "Herinnering inloggen",
    description:
      "Voor leden die eerder een uitnodiging kregen maar nog geen account hebben aangemaakt. Bevat stap-voor-stap inloginstructies.",
  },
  account_reminder: {
    title: "Herinnering account aanmaken",
    description: "Voor leden die nog geen account hebben aangemaakt op het ledenportaal.",
  },
};

const SYSTEM_KEYS = new Set([
  "member_welcome",
  "lead_welcome",
  "account_reminder",
  "login_reminder",
]);

const PLACEHOLDERS = ["{{contactpersoon}}", "{{coffeeshop}}", "{{plaats}}"];

export default function EmailTemplatesPage() {
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTpl, setNewTpl] = useState({ key: "", title: "", subject: "", body: "" });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("key");
      if (error) toast.error("Laden mislukt: " + error.message);
      else {
        setTemplates(data || []);
        if ((data || []).length > 0) setActiveKey((data as Tpl[])[0].key);
      }
      setLoading(false);
    })();
  }, []);

  if (!isAdmin) {
    return <div className="p-6">Geen toegang.</div>;
  }

  const update = (key: string, field: "subject" | "body", value: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.key === key ? { ...t, [field]: value } : t)),
    );
  };

  const save = async (tpl: Tpl) => {
    setSaving(tpl.key);
    const { error } = await supabase
      .from("email_templates")
      .update({ subject: tpl.subject, body: tpl.body, updated_at: new Date().toISOString() })
      .eq("key", tpl.key);
    setSaving(null);
    if (error) toast.error("Opslaan mislukt: " + error.message);
    else toast.success("Template opgeslagen");
  };

  const createTemplate = async () => {
    const key = newTpl.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!key) return toast.error("Sleutel is verplicht");
    if (templates.some((t) => t.key === key)) return toast.error("Sleutel bestaat al");
    if (!newTpl.subject.trim() || !newTpl.body.trim())
      return toast.error("Onderwerp en bericht zijn verplicht");
    setCreating(true);
    const { error } = await supabase.from("email_templates").insert({
      key,
      subject: newTpl.subject,
      body: newTpl.body,
    });
    setCreating(false);
    if (error) return toast.error("Aanmaken mislukt: " + error.message);
    if (newTpl.title.trim()) {
      TEMPLATE_LABELS[key] = { title: newTpl.title.trim(), description: "" };
    }
    const tpl: Tpl = { key, subject: newTpl.subject, body: newTpl.body };
    setTemplates((prev) => [...prev, tpl].sort((a, b) => a.key.localeCompare(b.key)));
    setActiveKey(key);
    setCreateOpen(false);
    setNewTpl({ key: "", title: "", subject: "", body: "" });
    toast.success("Template aangemaakt");
  };

  const deleteTemplate = async (key: string) => {
    const { error } = await supabase.from("email_templates").delete().eq("key", key);
    if (error) return toast.error("Verwijderen mislukt: " + error.message);
    setTemplates((prev) => {
      const next = prev.filter((t) => t.key !== key);
      if (activeKey === key && next.length > 0) setActiveKey(next[0].key);
      return next;
    });
    toast.success("Template verwijderd");
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 w-full">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Mail className="text-brand-red" />
          <h1 className="text-xl sm:text-2xl font-bold">E-mailtemplates</h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus size={14} /> Nieuwe template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nieuwe e-mailtemplate</DialogTitle>
              <DialogDescription>
                Geef een unieke sleutel (gebruikt in code en logs) en de inhoud van de mail.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Sleutel</Label>
                <Input
                  placeholder="bv. nieuwsbrief_juni"
                  value={newTpl.key}
                  onChange={(e) => setNewTpl((p) => ({ ...p, key: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alleen kleine letters, cijfers en _.
                </p>
              </div>
              <div>
                <Label className="text-xs">Naam (optioneel)</Label>
                <Input
                  placeholder="bv. Nieuwsbrief juni"
                  value={newTpl.title}
                  onChange={(e) => setNewTpl((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Onderwerp</Label>
                <Input
                  value={newTpl.subject}
                  onChange={(e) => setNewTpl((p) => ({ ...p, subject: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Bericht</Label>
                <Textarea
                  rows={10}
                  className="font-mono text-sm"
                  value={newTpl.body}
                  onChange={(e) => setNewTpl((p) => ({ ...p, body: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuleren
              </Button>
              <Button onClick={createTemplate} disabled={creating}>
                {creating ? "Aanmaken..." : "Aanmaken"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-sm text-muted-foreground">
        Pas onderwerp en bericht aan. Beschikbare placeholders:{" "}
        {PLACEHOLDERS.map((p) => (
          <code key={p} className="mx-1 px-1 py-0.5 rounded bg-muted text-xs">{p}</code>
        ))}
      </p>
      {loading ? (
        <p>Laden...</p>
      ) : templates.length === 0 ? (
        <p>Nog geen templates. Maak er één aan om te beginnen.</p>
      ) : (
        <Tabs value={activeKey} onValueChange={setActiveKey}>
          <TabsList className="flex-wrap h-auto">
            {templates.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {TEMPLATE_LABELS[t.key]?.title || t.key}
              </TabsTrigger>
            ))}
          </TabsList>
          {templates.map((tpl) => (
            <TabsContent key={tpl.key} value={tpl.key}>
              <Card className="border-2 border-primary/60">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {TEMPLATE_LABELS[tpl.key]?.title || tpl.key}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{tpl.key}</p>
                    </div>
                    {!SYSTEM_KEYS.has(tpl.key) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1.5">
                            <Trash2 size={14} /> Verwijderen
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Template verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{TEMPLATE_LABELS[tpl.key]?.title || tpl.key}" wordt definitief
                              verwijderd. Dit kan niet ongedaan worden gemaakt.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTemplate(tpl.key)}>
                              Verwijderen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  {TEMPLATE_LABELS[tpl.key]?.description && (
                    <p className="text-xs text-muted-foreground">
                      {TEMPLATE_LABELS[tpl.key].description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">Onderwerp</Label>
                    <Input
                      value={tpl.subject}
                      onChange={(e) => update(tpl.key, "subject", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bericht</Label>
                    <Textarea
                      value={tpl.body}
                      onChange={(e) => update(tpl.key, "body", e.target.value)}
                      rows={14}
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => save(tpl)} disabled={saving === tpl.key}>
                      {saving === tpl.key ? "Opslaan..." : "Opslaan"}
                    </Button>
                  </div>
                  {tpl.key === "member_welcome" || tpl.key === "lead_welcome" ? (
                    <div className="rounded-md border-2 border-primary/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                      Deze mail wordt automatisch verstuurd zodra je een{" "}
                      {tpl.key === "member_welcome" ? "nieuw lid" : "nieuwe lead"} toevoegt.
                      Bulkverzending is hier niet beschikbaar — je hebt geen 105 nieuwe leden tegelijk.
                    </div>
                  ) : (
                    <BulkEmailSend
                      templateKey={tpl.key}
                      template={{ subject: tpl.subject, body: tpl.body }}
                      emailTemplateName={
                        tpl.key === "login_reminder" ? "login-reminder" : "member-welcome"
                      }
                      defaultAudience={
                        tpl.key === "login_reminder"
                          ? "previously_mailed_no_account"
                          : tpl.key === "account_reminder"
                            ? "members_no_account"
                            : "members_all"
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
      <div className="pt-6 border-t">
        <EmailSendLog />
      </div>
    </div>
  );
}