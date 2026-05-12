import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
};

const PLACEHOLDERS = ["{{contactpersoon}}", "{{coffeeshop}}", "{{plaats}}"];

export default function EmailTemplatesPage() {
  const { isAdmin } = useAuth();
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("key");
      if (error) toast.error("Laden mislukt: " + error.message);
      else setTemplates(data || []);
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

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Mail className="text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">E-mailtemplates</h1>
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
        <p>Geen templates gevonden.</p>
      ) : (
        <Tabs defaultValue={templates[0].key}>
          <TabsList>
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
                  <CardTitle className="text-base">
                    {TEMPLATE_LABELS[tpl.key]?.title || tpl.key}
                  </CardTitle>
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
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}