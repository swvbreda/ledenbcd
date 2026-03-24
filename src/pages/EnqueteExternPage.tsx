import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Lock, CheckCircle } from "lucide-react";

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  required: boolean;
  sort_order: number;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
}

const ANDERS_OPTION = "Anders, namelijk: …";

const PCN_SURVEY_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

export default function EnqueteExternPage() {
  const { id: paramId } = useParams<{ id: string }>();
  const id = paramId || PCN_SURVEY_ID;
  const [accessCode, setAccessCode] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [respondentEmail, setRespondentEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccessCode = () => {
    if (accessCode.trim().toLowerCase() === ACCESS_CODE) {
      setAuthenticated(true);
      setLoading(true);
    } else {
      toast.error("Onjuiste toegangscode");
    }
  };

  useEffect(() => {
    if (!authenticated || !id) return;
    const load = async () => {
      const [{ data: s }, { data: q }] = await Promise.all([
        supabase.from("surveys").select("*").eq("id", id).single(),
        supabase.from("survey_questions").select("*").eq("survey_id", id).order("sort_order"),
      ]);
      setSurvey(s as Survey | null);
      setQuestions(
        ((q as any[]) ?? []).map((row) => ({
          ...row,
          options: Array.isArray(row.options) ? row.options : [],
        }))
      );
      setLoading(false);
    };
    load();
  }, [authenticated, id]);

  const setAnswer = (qId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  };

  const handleCheckbox = (qId: string, option: string, checked: boolean) => {
    setAnswers((prev) => {
      const current: string[] = prev[qId] ?? [];
      return {
        ...prev,
        [qId]: checked ? [...current, option] : current.filter((o: string) => o !== option),
      };
    });
  };

  const handleSubmit = async () => {
    if (!survey) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!respondentEmail.trim() || !emailRegex.test(respondentEmail.trim())) {
      toast.error("Vul een geldig e-mailadres in.");
      return;
    }

    for (const q of questions) {
      if (q.required) {
        const a = answers[q.id];
        if (!a || (typeof a === "string" && !a.trim()) || (Array.isArray(a) && a.length === 0)) {
          toast.error(`Beantwoord alsjeblieft: "${q.question_text}"`);
          return;
        }
      }
    }

    setSubmitting(true);

    const rows = questions.map((q) => ({
      survey_id: survey.id,
      question_id: q.id,
      answer: {
        value: answers[q.id] ?? null,
        source: "extern-pcn",
      },
      status: "pending",
      respondent_email: respondentEmail.trim().toLowerCase(),
    }));

    const { error } = await supabase.from("survey_responses").insert(rows);
    if (error) {
      toast.error("Fout bij opslaan: " + error.message);
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  };

  // Access code screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <Lock className="mx-auto mb-2 text-muted-foreground" size={32} />
            <CardTitle className="text-lg">Enquête toegang</CardTitle>
            <CardDescription>Voer de toegangscode in om de enquête te openen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Toegangscode"
              type="password"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccessCode()}
            />
            <Button onClick={handleAccessCode} className="w-full">
              Doorgaan
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Laden...</div>;
  if (!survey) return <div className="min-h-screen flex items-center justify-center text-destructive">Enquête niet gevonden.</div>;

  if (!survey.active) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="py-12 text-center text-muted-foreground">
            Deze enquête is gesloten.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="py-12 text-center space-y-3">
            <CheckCircle className="mx-auto text-primary" size={48} />
            <p className="text-lg font-medium">Bedankt!</p>
            <p className="text-sm text-muted-foreground">
              Je antwoorden zijn opgeslagen en worden door PCN gecontroleerd voordat ze worden meegeteld. Je kunt dit venster sluiten.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{survey.title}</CardTitle>
            {survey.description && <CardDescription>{survey.description}</CardDescription>}
            <p className="text-xs text-muted-foreground mt-2">
              Je antwoorden worden volledig anoniem opgeslagen.
            </p>
          </CardHeader>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <Label className="text-sm font-medium">
              E-mailadres <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              placeholder="naam@voorbeeld.nl"
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Jouw e-mailadres wordt alleen gebruikt ter verificatie door PCN. Antwoorden blijven anoniem in de resultaten.
            </p>
          </CardContent>
        </Card>

        {/* Questions */}
        {questions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Deze enquête heeft nog geen vragen.
            </CardContent>
          </Card>
        ) : (
          <>
            {questions.map((q, idx) => (
              <Card key={q.id}>
                <CardContent className="pt-6 space-y-3">
                  <Label className="text-sm font-medium">
                    {idx + 1}. {q.question_text}
                    {q.required && <span className="text-destructive ml-1">*</span>}
                  </Label>

                  {q.question_type === "text" && (
                    <Input
                      placeholder="Je antwoord..."
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                    />
                  )}

                  {q.question_type === "textarea" && (
                    <Textarea
                      placeholder="Je antwoord..."
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      rows={4}
                    />
                  )}

                  {q.question_type === "radio" && (
                    <div className="space-y-2">
                      <RadioGroup
                        value={(answers[q.id]?.startsWith?.("Anders: ") ? ANDERS_OPTION : answers[q.id]) ?? ""}
                        onValueChange={(v) => {
                          if (v === ANDERS_OPTION) {
                            setAnswer(q.id, "Anders: ");
                          } else {
                            setAnswer(q.id, v);
                          }
                        }}
                      >
                        {q.options.map((opt) => (
                          <div key={opt} className="flex items-center space-x-2">
                            <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                            <Label htmlFor={`${q.id}-${opt}`} className="font-normal">{opt}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {typeof answers[q.id] === "string" && answers[q.id]?.startsWith?.("Anders: ") && (
                        <Input
                          placeholder="Vul in..."
                          value={answers[q.id].replace("Anders: ", "")}
                          onChange={(e) => setAnswer(q.id, "Anders: " + e.target.value)}
                          className="ml-6 max-w-xs"
                        />
                      )}
                    </div>
                  )}

                  {q.question_type === "checkbox" && (
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const currentArr: string[] = answers[q.id] ?? [];
                        const isAnders = opt === ANDERS_OPTION;
                        const andersValue = currentArr.find((v: string) => v.startsWith("Anders: "));
                        const isChecked = isAnders ? !!andersValue : currentArr.includes(opt);
                        return (
                          <div key={opt}>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`${q.id}-${opt}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  if (isAnders) {
                                    if (checked) {
                                      setAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: [...(prev[q.id] ?? []).filter((v: string) => !v.startsWith("Anders: ")), "Anders: "],
                                      }));
                                    } else {
                                      setAnswers((prev) => ({
                                        ...prev,
                                        [q.id]: (prev[q.id] ?? []).filter((v: string) => !v.startsWith("Anders: ")),
                                      }));
                                    }
                                  } else {
                                    handleCheckbox(q.id, opt, !!checked);
                                  }
                                }}
                              />
                              <Label htmlFor={`${q.id}-${opt}`} className="font-normal">{opt}</Label>
                            </div>
                            {isAnders && andersValue !== undefined && (
                              <Input
                                placeholder="Vul in..."
                                value={andersValue.replace("Anders: ", "")}
                                onChange={(e) => {
                                  setAnswers((prev) => ({
                                    ...prev,
                                    [q.id]: [
                                      ...(prev[q.id] ?? []).filter((v: string) => !v.startsWith("Anders: ")),
                                      "Anders: " + e.target.value,
                                    ],
                                  }));
                                }}
                                className="ml-6 mt-1 max-w-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.question_type === "scale" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          onClick={() => setAnswer(q.id, n)}
                          className={`w-9 h-9 rounded-md border text-sm font-medium transition-colors ${
                            answers[q.id] === n
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Verzenden..." : "Antwoorden versturen"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
