import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PCN_EMAIL = "info@platformcannabis.nl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, CheckCircle2, ClipboardList, BarChart3, Trash2, Shield, Share2, Copy, Users } from "lucide-react";
import BcdHeroBanner from "@/components/BcdHeroBanner";

interface Survey {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  created_at: string;
}

export default function EnquetesPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [completions, setCompletions] = useState<string[]>([]);
  const [responseCounts, setResponseCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { data: surveyData } = await supabase
      .from("surveys")
      .select("*")
      .order("created_at", { ascending: false });
    setSurveys((surveyData as Survey[]) ?? []);

    if (user) {
      const { data: compData } = await supabase
        .from("survey_completions")
        .select("survey_id")
        .eq("user_id", user.id);
      setCompletions((compData ?? []).map((c: any) => c.survey_id));
    }

    // Fetch response counts per survey (count unique submissions via distinct submitted_at)
    const { data: countData } = await supabase
      .from("survey_responses")
      .select("survey_id, submitted_at")
      .eq("status", "approved");
    const counts: Record<string, number> = {};
    const seen = new Set<string>();
    (countData ?? []).forEach((r: any) => {
      const key = `${r.survey_id}__${r.submitted_at}`;
      if (!seen.has(key)) {
        seen.add(key);
        counts[r.survey_id] = (counts[r.survey_id] || 0) + 1;
      }
    });
    setResponseCounts(counts);

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from("surveys").insert({
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Fout bij aanmaken: " + error.message);
    } else {
      toast.success("Enquête aangemaakt");
      setCreateOpen(false);
      setNewTitle("");
      setNewDesc("");
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze enquête wilt verwijderen?")) return;
    const { error } = await supabase.from("surveys").delete().eq("id", id);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from("surveys").update({ active: !active }).eq("id", id);
    fetchData();
  };

  if (loading) {
    return <div className="p-6"><p className="text-muted-foreground">Laden...</p></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 w-full max-w-4xl mx-auto">
      <BcdHeroBanner title="Enquêtes" subtitle="Anonieme enquêtes voor leden">
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)} size="sm" variant="secondary">
            <Plus size={16} className="mr-1" /> Nieuwe enquête
          </Button>
        )}
      </BcdHeroBanner>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardList size={48} className="mx-auto mb-3 opacity-40" />
            <p>Nog geen enquêtes beschikbaar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {surveys.map((s) => {
            const completed = completions.includes(s.id);
            return (
              <Card key={s.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{s.title}</CardTitle>
                      {s.description && (
                        <CardDescription className="mt-1">{s.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isAdmin && (
                        <Badge variant="outline" className="gap-1">
                          <Users size={12} /> {responseCounts[s.id] || 0} respondent{(responseCounts[s.id] || 0) !== 1 ? "en" : ""}
                        </Badge>
                      )}
                      {completed && (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 size={12} /> Ingevuld
                        </Badge>
                      )}
                      {!s.active && <Badge variant="outline">Gesloten</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2 flex-wrap">
                     {s.active && !completed && (
                       <Button size="sm" onClick={() => navigate(`/enquetes/${s.id}`)}>
                         Invullen
                       </Button>
                     )}
                     {s.active && (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => {
                           const url = `${window.location.origin}/enquetes/${s.id}`;
                           navigator.clipboard.writeText(url).then(() => {
                             toast.success("Link gekopieerd naar klembord");
                           }).catch(() => {
                             prompt("Kopieer deze link:", url);
                           });
                         }}
                       >
                         <Share2 size={14} className="mr-1" /> Deel link
                       </Button>
                     )}
                     {completed && (
                       <p className="text-xs text-muted-foreground">Je hebt deze enquête al ingevuld.</p>
                     )}
                     {user?.email?.toLowerCase() === PCN_EMAIL && s.active && (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => navigate(`/enquetes/${s.id}/review`)}
                       >
                         <Shield size={14} className="mr-1" /> Responses beoordelen
                       </Button>
                     )}
                     {isAdmin && (
                       <>
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => navigate(`/enquetes/${s.id}/beheer`)}
                         >
                           <BarChart3 size={14} className="mr-1" /> Beheer & resultaten
                         </Button>
                         <Button
                           size="sm"
                           variant="ghost"
                           onClick={() => handleToggleActive(s.id, s.active)}
                         >
                           {s.active ? "Sluiten" : "Heropenen"}
                         </Button>
                         <Button
                           size="sm"
                           variant="ghost"
                           className="text-destructive"
                           onClick={() => handleDelete(s.id)}
                         >
                           <Trash2 size={14} />
                         </Button>
                       </>
                     )}
                   </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe enquête aanmaken</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Titel van de enquête"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Beschrijving (optioneel)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={3}
            />
            <Button onClick={handleCreate} disabled={saving || !newTitle.trim()} className="w-full">
              {saving ? "Aanmaken..." : "Enquête aanmaken"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
