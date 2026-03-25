import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, Store, Clock } from "lucide-react";

interface ResponseGroup {
  respondent_email: string;
  submitted_at: string;
  responses: Array<{
    id: string;
    question_id: string;
    answer: { value: any; source?: string };
    status: string;
  }>;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  sort_order: number;
}

const PCN_EMAIL = "info@platformcannabis.nl";

export default function EnqueteReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [groups, setGroups] = useState<ResponseGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const isPCN = user?.email?.toLowerCase() === PCN_EMAIL;
  const hasAccess = isAdmin || isPCN;

  const fetchData = async () => {
    if (!id) return;
    const [{ data: s }, { data: q }, { data: r }] = await Promise.all([
      supabase.from("surveys").select("*").eq("id", id).single(),
      supabase.from("survey_questions").select("*").eq("survey_id", id).order("sort_order"),
      supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", id)
        .not("respondent_email", "is", null),
    ]);

    setSurvey(s);
    setQuestions(
      ((q as any[]) ?? []).map((row) => ({
        ...row,
      }))
    );

    // Group responses by respondent_email + submitted_at (rounded to minute)
    const rows = (r ?? []) as any[];
    const grouped: Record<string, ResponseGroup> = {};
    for (const row of rows) {
      const key = row.respondent_email + "|" + row.submitted_at?.slice(0, 16);
      if (!grouped[key]) {
        grouped[key] = {
          respondent_email: row.respondent_email,
          submitted_at: row.submitted_at,
          responses: [],
        };
      }
      grouped[key].responses.push({
        id: row.id,
        question_id: row.question_id,
        answer: row.answer,
        status: row.status,
      });
    }
    setGroups(Object.values(grouped).sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const updateStatus = async (group: ResponseGroup, newStatus: "approved" | "rejected") => {
    const ids = group.responses.map((r) => r.id);
    const { error } = await supabase
      .from("survey_responses")
      .update({ status: newStatus })
      .in("id", ids);

    if (error) {
      toast.error("Fout: " + error.message);
    } else {
      toast.success(newStatus === "approved" ? "Goedgekeurd" : "Afgewezen");
      fetchData();
    }
  };

  if (!hasAccess) {
    return <div className="p-6 text-destructive">Geen toegang.</div>;
  }

  if (loading) return <div className="p-6 text-muted-foreground">Laden...</div>;
  if (!survey) return <div className="p-6 text-destructive">Enquête niet gevonden.</div>;

  const getQuestionText = (qId: string) => {
    const q = questions.find((q) => q.id === qId);
    return q?.question_text ?? "Onbekende vraag";
  };

  const formatAnswer = (value: any) => {
    if (Array.isArray(value)) return value.join(", ");
    if (value === null || value === undefined) return "-";
    return String(value);
  };

  const pendingGroups = groups.filter((g) => g.responses[0]?.status === "pending");
  const reviewedGroups = groups.filter((g) => g.responses[0]?.status !== "pending");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} className="mr-1" /> Terug
      </Button>

      <div>
        <h1 className="text-xl font-bold">{survey.title} — Externe responses</h1>
        <p className="text-sm text-muted-foreground">
          Controleer en keur externe inzendingen goed of af.
        </p>
      </div>

      {pendingGroups.length === 0 && reviewedGroups.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nog geen externe inzendingen ontvangen.
          </CardContent>
        </Card>
      )}

      {pendingGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
            <Clock size={14} /> Te beoordelen ({pendingGroups.length})
          </h2>
          {pendingGroups.map((group, idx) => (
            <Card key={idx}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{group.respondent_email}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {new Date(group.submitted_at).toLocaleDateString("nl-NL")}
                  </Badge>
                </div>

                <div className="space-y-1.5 border-t pt-2">
                  {group.responses
                    .sort((a, b) => {
                      const qa = questions.find((q) => q.id === a.question_id);
                      const qb = questions.find((q) => q.id === b.question_id);
                      return (qa?.sort_order ?? 0) - (qb?.sort_order ?? 0);
                    })
                    .map((r) => (
                      <div key={r.id} className="text-xs">
                        <span className="text-muted-foreground">{getQuestionText(r.question_id)}:</span>{" "}
                        <span className="font-medium">{formatAnswer(r.answer?.value)}</span>
                      </div>
                    ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => updateStatus(group, "approved")}
                    className="gap-1"
                  >
                    <CheckCircle size={14} /> Goedkeuren
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(group, "rejected")}
                    className="gap-1"
                  >
                    <XCircle size={14} /> Afwijzen
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {reviewedGroups.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Beoordeeld ({reviewedGroups.length})
          </h2>
          {reviewedGroups.map((group, idx) => (
            <Card key={idx} className="opacity-75">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-muted-foreground" />
                    <span className="text-sm">{group.respondent_email}</span>
                  </div>
                  <Badge
                    variant={group.responses[0]?.status === "approved" ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {group.responses[0]?.status === "approved" ? "Goedgekeurd" : "Afgewezen"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
