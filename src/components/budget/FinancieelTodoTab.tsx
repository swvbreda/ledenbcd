import { useState, useMemo, useEffect, useRef } from "react";
import { CheckCircle2, Clock, Sparkles, User, X, RotateCcw, Loader2, Plus, StickyNote, ChevronDown, ChevronUp, Send, PauseCircle, Paperclip, FileText, Trash2 } from "lucide-react";
import { useFinanceTodos, useFinanceTodoMutations, type FinanceTodo } from "@/hooks/useFinanceTodos";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Props {
  year: number;
}

const typeLabels: Record<string, string> = {
  new_member_invoice: "Factuur aanmaken",
  unpaid_contribution: "Betaling opvolgen",
  overdue_invoice: "Betalingsherinnering",
  pending_declaration: "Declaratie goedkeuren",
  manual: "Handmatig",
};

const typeColors: Record<string, string> = {
  new_member_invoice: "bg-blue-100 text-blue-800",
  unpaid_contribution: "bg-amber-100 text-amber-800",
  overdue_invoice: "bg-red-100 text-red-800",
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
  const { complete, dismiss, hold, reopen, addTodo, updateNotes, uploadFile, removeFile } = useFinanceTodoMutations(year);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingTodoId, setUploadingTodoId] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Add form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("secretariaat");
  const [newDueDate, setNewDueDate] = useState("");

  // Notes editing
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

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

  useEffect(() => {
    generateTodos();
  }, [year]);

  const pending = useMemo(
    () => (todos ?? []).filter((t) => t.status === "pending"),
    [todos]
  );

  const onHold = useMemo(
    () => (todos ?? []).filter((t) => t.status === "on_hold"),
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

  const handleAddTodo = () => {
    if (!newTitle.trim()) return;
    addTodo.mutate(
      {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        assigned_to: newAssignee,
        due_date: newDueDate || null,
      },
      {
        onSuccess: () => {
          toast.success("Taak aangemaakt");
          setNewTitle("");
          setNewDescription("");
          setNewDueDate("");
          setShowAddForm(false);
        },
      }
    );
  };

  const handleSaveNote = (todoId: string) => {
    updateNotes.mutate(
      { id: todoId, notes: noteText, notes_by: user?.email || "Onbekend" },
      {
        onSuccess: () => {
          toast.success("Notitie opgeslagen");
          setEditingNoteId(null);
          setNoteText("");
        },
      }
    );
  };

  const handleFileUpload = (todoId: string) => {
    setUploadingTodoId(todoId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingTodoId) return;
    uploadFile.mutate(
      { id: uploadingTodoId, file },
      {
        onSuccess: () => {
          toast.success("Bestand geüpload");
          setUploadingTodoId(null);
        },
        onError: (err: any) => toast.error("Upload mislukt: " + err.message),
      }
    );
    e.target.value = "";
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage.from("finance-todo-files").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleDownloadFile = async (filePath: string) => {
    const { data, error } = await supabase.storage.from("finance-todo-files").createSignedUrl(filePath, 60);
    if (error) { toast.error("Kan bestand niet openen"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const toggleNotes = (id: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-1.5 h-8 text-xs"
          >
            <Plus size={12} />
            Taak toevoegen
          </Button>
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

      {/* Add form */}
      {showAddForm && (
        <Card className="border-border">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold">Nieuwe taak</h4>
            <Input
              placeholder="Titel van de taak..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddTodo()}
            />
            <Textarea
              placeholder="Beschrijving (optioneel)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="text-sm min-h-[60px]"
              rows={2}
            />
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="secretariaat" className="text-xs">Secretariaat</SelectItem>
                  <SelectItem value="penningmeester" className="text-xs">Penningmeester</SelectItem>
                  <SelectItem value="bestuur" className="text-xs">Bestuur</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="h-8 text-xs w-[160px]"
                placeholder="Deadline"
              />
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowAddForm(false)}>
                  Annuleer
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={handleAddTodo} disabled={!newTitle.trim()}>
                  Toevoegen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              <div key={todo.id}>
                <div className="px-4 py-3 flex items-start gap-3 hover:bg-muted/20 transition-colors">
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
                      {todo.member_id && <span>Lid #{todo.member_id}</span>}
                      <span>{fmtDate(todo.created_at)}</span>
                      <button
                        onClick={() => toggleNotes(todo.id)}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                        title="Notities"
                      >
                        <StickyNote size={10} />
                        {todo.notes ? "Notitie" : "Notitie toevoegen"}
                        {expandedNotes.has(todo.id) ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => hold.mutate(todo.id, { onSuccess: () => toast.success("Taak on hold gezet") })}
                      className="p-1 text-muted-foreground hover:text-amber-600"
                      title="On hold zetten"
                    >
                      <PauseCircle size={14} />
                    </button>
                    <button
                      onClick={() => dismiss.mutate(todo.id, { onSuccess: () => toast.success("Taak genegeerd") })}
                      className="p-1 text-muted-foreground hover:text-destructive"
                      title="Negeren"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Notes section */}
                {expandedNotes.has(todo.id) && (
                  <div className="px-4 pb-3 pl-12">
                    {todo.notes && editingNoteId !== todo.id && (
                      <div
                        className="text-xs bg-muted/40 rounded p-2 mb-2 cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => {
                          setEditingNoteId(todo.id);
                          setNoteText(todo.notes || "");
                        }}
                      >
                        <p>{todo.notes}</p>
                        {todo.notes_by && (
                          <p className="text-muted-foreground mt-1 italic">— {todo.notes_by}</p>
                        )}
                      </div>
                    )}
                    {(editingNoteId === todo.id || !todo.notes) && (
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Notitie schrijven..."
                          value={editingNoteId === todo.id ? noteText : ""}
                          onChange={(e) => {
                            if (editingNoteId !== todo.id) {
                              setEditingNoteId(todo.id);
                              setNoteText(e.target.value);
                            } else {
                              setNoteText(e.target.value);
                            }
                          }}
                          onFocus={() => {
                            if (editingNoteId !== todo.id) {
                              setEditingNoteId(todo.id);
                              setNoteText(todo.notes || "");
                            }
                          }}
                          className="text-xs min-h-[50px] flex-1"
                          rows={2}
                        />
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => handleSaveNote(todo.id)}
                            disabled={!noteText.trim() && !todo.notes}
                            title="Opslaan"
                          >
                            <Send size={12} />
                          </Button>
                          {editingNoteId === todo.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingNoteId(null);
                                setNoteText("");
                              }}
                              title="Annuleren"
                            >
                              <X size={12} />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {pending.length === 0 && !showAddForm && (
        <div className="flex items-center gap-3 py-6 px-4 rounded-lg border border-border bg-muted/30">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <p className="text-sm text-muted-foreground">Alles is up-to-date voor {year}. Geen openstaande taken.</p>
        </div>
      )}

      {/* On Hold section */}
      {onHold.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PauseCircle size={14} className="text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              On hold
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{onHold.length}</Badge>
          </div>
          <div className="border border-border rounded-lg divide-y divide-border overflow-hidden opacity-75">
            {onHold.map((todo) => (
              <div key={todo.id} className="px-4 py-2 flex items-center gap-3">
                <PauseCircle size={14} className="text-amber-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{todo.title}</span>
                  {todo.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5 italic">{todo.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => reopen.mutate(todo.id, { onSuccess: () => toast.success("Taak heropend") })}
                  className="p-1 text-muted-foreground hover:text-foreground"
                  title="Heractiveren"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
