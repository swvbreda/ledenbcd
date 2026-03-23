import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, Link2, Copy, Shield } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  required: boolean;
  sort_order: number;
}

interface ResponseRow {
  question_id: string;
  answer: { value: any };
  submitted_at: string;
  status: string;
  respondent_email: string | null;
}

export default function EnqueteBeheerPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [completionCount, setCompletionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // New question form
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState("text");
  const [qOptions, setQOptions] = useState("");
  const [qRequired, setQRequired] = useState(true);

  const fetchData = async () => {
    if (!id) return;
    const [{ data: s }, { data: q }, { data: r }, { data: c }] = await Promise.all([
      supabase.from("surveys").select("*").eq("id", id).single(),
      supabase.from("survey_questions").select("*").eq("survey_id", id).order("sort_order"),
      supabase.from("survey_responses").select("*").eq("survey_id", id),
      supabase.from("survey_completions").select("id").eq("survey_id", id),
    ]);
    setSurvey(s);
    setQuestions(
      ((q as any[]) ?? []).map((row) => ({
        ...row,
        options: Array.isArray(row.options) ? row.options : [],
      }))
    );
    setResponses(((r ?? []) as unknown as ResponseRow[]));
    setCompletionCount((c ?? []).length);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  if (!isAdmin) {
    return <div className="p-6 text-destructive">Alleen admins hebben toegang.</div>;
  }

  const addQuestion = async () => {
    if (!qText.trim() || !id) return;
    const options =
      qType === "radio" || qType === "checkbox"
        ? qOptions.split(",").map((o) => o.trim()).filter(Boolean)
        : [];

    const { error } = await supabase.from("survey_questions").insert({
      survey_id: id,
      question_text: qText.trim(),
      question_type: qType,
      options,
      required: qRequired,
      sort_order: questions.length,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setQText("");
      setQOptions("");
      fetchData();
    }
  };

  const deleteQuestion = async (qId: string) => {
    if (!confirm("Vraag verwijderen?")) return;
    await supabase.from("survey_questions").delete().eq("id", qId);
    fetchData();
  };

  // Aggregate results per question
  const getResults = (questionId: string, question: Question) => {
    // Only count approved responses in results
    const qResponses = responses.filter((r) => r.question_id === questionId && r.status === "approved");
    if (qResponses.length === 0) return null;

    if (question.question_type === "scale") {
      const values = qResponses.map((r) => r.answer?.value).filter((v) => typeof v === "number");
      const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "-";
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

    // Text
    const texts = qResponses.map((r) => r.answer?.value).filter(Boolean);
    return { type: "text", texts };
  };

  if (loading) return <div className="p-6 text-muted-foreground">Laden...</div>;
  if (!survey) return <div className="p-6 text-destructive">Enquête niet gevonden.</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/enquetes")}>
        <ArrowLeft size={16} className="mr-1" /> Terug
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{survey.title}</h1>
          <p className="text-sm text-muted-foreground">
            {completionCount} intern{completionCount === 1 ? "e reactie" : "e reacties"}
            {(() => {
              const approvedExt = new Set(responses.filter(r => r.status === "approved" && r.respondent_email).map(r => r.respondent_email)).size;
              const pendingExt = new Set(responses.filter(r => r.status === "pending" && r.respondent_email).map(r => r.respondent_email)).size;
              const parts = [];
              if (approvedExt > 0) parts.push(`${approvedExt} extern goedgekeurd`);
              if (pendingExt > 0) parts.push(`${pendingExt} extern in afwachting`);
              return parts.length > 0 ? ` · ${parts.join(", ")}` : "";
            })()}
          </p>
        </div>
        <Badge variant={survey.active ? "default" : "secondary"}>
          {survey.active ? "Actief" : "Gesloten"}
        </Badge>
      </div>

      {/* Externe link info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <Link2 size={16} className="mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Externe link (PCN)</p>
              <p className="text-xs text-muted-foreground mb-2">
                Deel deze link met Platform Cannabis Nederland. Toegangscode: <code className="bg-muted px-1 rounded">pcn2026</code>
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded truncate block flex-1">
                  {window.location.origin}/enquete-extern/{id}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/enquete-extern/${id}`);
                    toast.success("Link gekopieerd!");
                  }}
                >
                  <Copy size={14} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review link */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-start gap-2">
            <Shield size={16} className="mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Externe responses beoordelen</p>
              <p className="text-xs text-muted-foreground mb-2">
                Externe inzendingen moeten eerst worden goedgekeurd voordat ze meetellen in de resultaten.
                {(() => {
                  const pendingCount = responses.filter(r => r.status === "pending" && r.respondent_email).length;
                  const uniquePending = new Set(responses.filter(r => r.status === "pending" && r.respondent_email).map(r => r.respondent_email)).size;
                  return uniquePending > 0 ? ` (${uniquePending} in afwachting)` : "";
                })()}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/enquetes/${id}/review`)}
              >
                Bekijk externe responses
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">Vragen ({questions.length})</TabsTrigger>
          <TabsTrigger value="results">Resultaten</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="space-y-4 mt-4">
          {questions.map((q, idx) => (
            <Card key={q.id}>
              <CardContent className="pt-4 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {idx + 1}. {q.question_text}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                    {q.options.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Opties: {q.options.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteQuestion(q.id)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vraag toevoegen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Vraagtekst"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Type</Label>
                  <Select value={qType} onValueChange={setQType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Korte tekst</SelectItem>
                      <SelectItem value="textarea">Lange tekst</SelectItem>
                      <SelectItem value="radio">Keuze (één antwoord)</SelectItem>
                      <SelectItem value="checkbox">Meerkeuze</SelectItem>
                      <SelectItem value="scale">Schaal (1-10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={qRequired}
                      onChange={(e) => setQRequired(e.target.checked)}
                      className="rounded"
                    />
                    Verplicht
                  </label>
                </div>
              </div>
              {(qType === "radio" || qType === "checkbox") && (
                <div>
                  <Label className="text-xs mb-1 block">Opties (komma-gescheiden)</Label>
                  <Input
                    placeholder="Optie 1, Optie 2, Optie 3"
                    value={qOptions}
                    onChange={(e) => setQOptions(e.target.value)}
                  />
                </div>
              )}
              <Button onClick={addQuestion} disabled={!qText.trim()} size="sm">
                <Plus size={14} className="mr-1" /> Toevoegen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4 mt-4">
          {completionCount === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nog geen reacties ontvangen.
              </CardContent>
            </Card>
          ) : (
            questions.map((q, idx) => {
              const result = getResults(q.id, q);
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
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
