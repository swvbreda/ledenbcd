import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, Store, Clock, BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

interface ResponseGroup {
  coffeeshop_name: string;
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
  const [allResponses, setAllResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isPCN = user?.email?.toLowerCase() === PCN_EMAIL;
  const hasAccess = isAdmin || isPCN;

  const fetchData = async () => {
    if (!id) return;
    const [{ data: s }, { data: q }, { data: r }, { data: allR }] = await Promise.all([
      supabase.from("surveys").select("*").eq("id", id).single(),
      supabase.from("survey_questions").select("*").eq("survey_id", id).order("sort_order"),
      supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", id)
        .not("respondent_email", "is", null),
      supabase
        .from("survey_responses")
        .select("*")
        .eq("survey_id", id)
        .eq("status", "approved"),
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
          coffeeshop_name: row.respondent_email,
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
    setAllResponses((allR ?? []) as any[]);
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

  const getResults = (questionId: string, question: Question) => {
    const qResponses = allResponses.filter((r) => r.question_id === questionId);
    if (qResponses.length === 0) return null;

    if (question.question_type === "scale") {
      const values = qResponses.map((r) => r.answer?.value).filter((v: any) => typeof v === "number");
      const avg = values.length ? (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(1) : "-";
      return { type: "scale", avg, count: values.length };
    }

    if (question.question_type === "radio" || question.question_type === "checkbox") {
      const counts: Record<string, number> = {};
      for (const r of qResponses) {
        const val = r.answer?.value;
        const items = Array.isArray(val) ? val : [val];
        for (const item of items) {
          if (item) counts[item] = (counts[item] || 0) + 1;
        }
      }
      return { type: "choice", counts, total: qResponses.length };
    }

    const texts = qResponses.map((r: any) => r.answer?.value).filter(Boolean);
    return { type: "text", texts };
  };

  const approvedCount = new Set(
    allResponses.filter(r => !r.respondent_email).map(r => r.submitted_at)
  ).size;

  const approvedExtCount = new Set(
    allResponses.filter(r => r.respondent_email).map(r => r.respondent_email)
  ).size;

  const pendingGroups = groups.filter((g) => g.responses[0]?.status === "pending");
  const reviewedGroups = groups.filter((g) => g.responses[0]?.status !== "pending");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} className="mr-1" /> Terug
      </Button>

      <div>
        <h1 className="text-xl font-bold">{survey.title}</h1>
        <p className="text-sm text-muted-foreground">
          {approvedCount} intern{approvedCount === 1 ? "e reactie" : "e reacties"}
          {approvedExtCount > 0 && ` · ${approvedExtCount} extern goedgekeurd`}
        </p>
      </div>

      <Tabs defaultValue="review">
        <TabsList>
          <TabsTrigger value="review">Beoordelen</TabsTrigger>
          <TabsTrigger value="results">Resultaten</TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-4 mt-4">
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
                        <Store size={14} className="text-muted-foreground" />
                        <span className="text-sm font-medium">{group.coffeeshop_name}</span>
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
                        <Store size={14} className="text-muted-foreground" />
                        <span className="text-sm">{group.coffeeshop_name}</span>
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
        </TabsContent>

        <TabsContent value="results" className="space-y-4 mt-4">
          {allResponses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nog geen goedgekeurde reacties.
              </CardContent>
            </Card>
          ) : (
            <>
              {questions.map((q, idx) => {
                const result = getResults(q.id, q);
                const qResponses = allResponses.filter((r) => r.question_id === q.id);
                return (
                  <Card key={q.id}>
                    <CardContent className="pt-4 space-y-2">
                      <p className="text-sm font-medium">
                        {idx + 1}. {q.question_text}
                      </p>
                      {!result && (
                        <p className="text-xs text-muted-foreground">Geen antwoorden</p>
                      )}
                      {result?.type === "scale" && (
                        <div className="flex items-center gap-4">
                          <span className="text-2xl font-bold text-primary">{result.avg}</span>
                          <span className="text-xs text-muted-foreground">gemiddelde ({result.count} antwoorden)</span>
                        </div>
                      )}
                      {result?.type === "choice" && (
                        <div className="space-y-1">
                          {Object.entries(result.counts).sort(([, a], [, b]) => (b as number) - (a as number)).map(([option, count]) => (
                            <div key={option} className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span>{option}</span>
                                  <span className="text-muted-foreground">
                                    {count} ({Math.round(((count as number) / (result.total as number)) * 100)}%)
                                  </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${((count as number) / (result.total as number)) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {result?.type === "text" && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {(result.texts as string[]).map((t, i) => (
                            <p key={i} className="text-xs bg-muted/50 rounded px-2 py-1">{t}</p>
                          ))}
                        </div>
                      )}

                      {qResponses.length > 0 && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground w-full justify-start gap-1 mt-1 px-0">
                              <ChevronDown size={12} />
                              Bekijk individuele antwoorden ({qResponses.length})
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="mt-2 border rounded-md overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium">#</th>
                                    <th className="text-left px-3 py-1.5 font-medium">Antwoord</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {qResponses.map((r: any, i: number) => {
                                    const val = r.answer?.value;
                                    const display = Array.isArray(val) ? val.join(", ") : String(val ?? "-");
                                    return (
                                      <tr key={i} className="border-t border-muted/50">
                                        <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">{i + 1}</td>
                                        <td className="px-3 py-1.5">{display}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
