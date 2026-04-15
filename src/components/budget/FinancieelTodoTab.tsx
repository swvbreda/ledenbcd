import { useState, useMemo, useEffect } from "react";
import { CheckCircle2, Clock, AlertCircle, Sparkles, User, X, RotateCcw, Loader2 } from "lucide-react";
import { useFinanceTodos, useFinanceTodoMutations, type FinanceTodo } from "@/hooks/useFinanceTodos";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  year: number;
}

const typeLabels: Record<string, string> = {
  new_member_invoice: "Factuur aanmaken",
  overdue_invoice: "Betalingsherinnering",
  pending_declaration: "Declaratie goedkeuren",
  manual: "Handmatig",
};

const typeColors: Record<string, string> = {
  new_member_invoice: "bg-blue-100 text-blue-800",
  overdue_invoice: "bg-amber-100 text-amber-800",
  pending_declaration: "bg-orange-100 text-orange-800",
  manual: "bg-muted text-muted-foreground",
};

const assigneeLabels: Record<string, string> = {
  secretariaat: "Secretariaat",
  penningmeester: "Penningmeester",
  bestuur: "Bestuur",
};

const fmtDate = (d: string | null) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
};

export default function FinancieelTodoTab({ year }: Props) {
  const { data: todos, isLoading, refetch } = useFinanceTodos(year);
  const { complete, dismiss, reopen } = useFinanceTodoMutations(year);
  const [aiSummary, setAiSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const generateTodos = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-finance-todos", {
        body: { year },
      });
      if (error) throw error;
      if (data?.aiSummary) setAiSummary(data.aiSummary);
      if (data?.created > 0) {
        toast.success(`${data.created} nieuwe taken aangemaakt`);
      }
      refetch();
    } catch (e: any) {
      toast.error("Fout bij genereren: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  // Auto-generate on mount
  useEffect(() => {
    generateTodos();
  }, [year]);

  const pending = useMemo(
    () => (todos ?? []).filter((t) => t.status === "pending"),
    [todos]
  );

  const done = useMemo(
    () => (todos ?? []).filter((t) => t.status === "done" || t.status === "dismissed"),
    [todos]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, FinanceTodo[]> = {};
    for (const t of pending) {
      const key = t.assigned_to;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [pending]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {/* AI Summary */}
      {aiSummary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="text-primary shrink-0 mt-1" />
              <div className="text-sm prose prose-sm max-w-none">
                <ReactMarkdown>{aiSummary}</ReactMarkdown>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {pending.length === 0 ? "Geen openstaande taken" : `${pending.length} openstaande taken`}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={generateTodos}
            disabled={generating}
            className="gap-1.5 h-8 text-xs"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Taken genereren
          </Button>
        </div>
      </div>

      {/* Grouped by assignee */}
      {Object.entries(grouped).map(([assignee, items]) => (
        <div key={assignee} className="space-y-2">
          <div className="flex items-center gap-2">
            <User size={14} className="text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {assigneeLabels[assignee] || assignee}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
          </div>
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
            {items.map((todo) => (
              <div key={todo.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
                <button
                  onClick={() => {
                    complete.mutate(todo.id, { onSuccess: () => toast.success("Taak afgerond") });
                  }}
                  className="mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 border-muted-foreground/40 hover:border-primary hover:bg-primary/10 transition-colors"
                  title="Markeer als afgerond"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{todo.title}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[todo.todo_type] || typeColors.manual}`}>
                      {typeLabels[todo.todo_type] || todo.todo_type}
                    </Badge>
                  </div>
                  {todo.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{todo.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    {todo.due_date && (
                      <span className="flex items-center gap-1">
                        <Clock size={10} /> {fmtDate(todo.due_date)}
                      </span>
                    )}
                    {todo.member_id && (
                      <span>Lid #{todo.member_id}</span>
                    )}
                    <span>{fmtDate(todo.created_at)}</span>
                  </div>
                </div>
                <button
                  onClick={() => dismiss.mutate(todo.id, { onSuccess: () => toast.success("Taak genegeerd") })}
                  className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                  title="Negeren"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {pending.length === 0 && (
        <div className="flex items-center gap-3 py-6 px-4 rounded-lg border border-border bg-muted/30">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <p className="text-sm text-muted-foreground">Alles is up-to-date voor {year}. Geen openstaande taken.</p>
        </div>
      )}

      {/* Done section */}
      {done.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone(!showDone)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDone ? "Verberg" : "Toon"} afgeronde taken ({done.length})
          </button>
          {showDone && (
            <div className="mt-2 border border-border rounded-lg divide-y divide-border overflow-hidden opacity-60">
              {done.map((todo) => (
                <div key={todo.id} className="px-4 py-2 flex items-center gap-3">
                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  <span className="text-sm line-through flex-1">{todo.title}</span>
                  <button
                    onClick={() => reopen.mutate(todo.id, { onSuccess: () => toast.success("Taak heropend") })}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title="Heropenen"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
