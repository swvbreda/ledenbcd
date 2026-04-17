import { useState, useMemo, useEffect, useRef } from "react";
import { CheckCircle2, Clock, Sparkles, User, X, RotateCcw, Loader2, Plus, StickyNote, ChevronDown, ChevronUp, Send, PauseCircle, Paperclip, FileText, Trash2, Upload, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import AdminUploadDialog from "./AdminUploadDialog";
import { useFinanceTodos, useFinanceTodoMutations, type FinanceTodo } from "@/hooks/useFinanceTodos";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
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
  member_archived: "Opzegging verwerken",
  manual: "Handmatig",
};

const typeCategoryLabels: Record<string, string> = {
  contributie: "Contributies",
  crediteur: "Crediteuren",
  declaratie: "Declaraties",
  overig: "Overig",
};

const getTypeCategory = (todoType: string): string => {
  if (["new_member_invoice", "unpaid_contribution", "overdue_invoice"].includes(todoType)) return "contributie";
  if (todoType === "pending_declaration") return "declaratie";
  if (todoType === "member_archived") return "overig";
  return "overig";
};

const typeColors: Record<string, string> = {
  new_member_invoice: "bg-blue-100 text-blue-800",
  unpaid_contribution: "bg-amber-100 text-amber-800",
  overdue_invoice: "bg-red-100 text-red-800",
  pending_declaration: "bg-orange-100 text-orange-800",
  member_archived: "bg-rose-100 text-rose-800",
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
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [holdDialogId, setHoldDialogId] = useState<string | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [sortKey, setSortKey] = useState<"title" | "todo_type" | "assigned_to" | "member_id" | "due_date" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  const sortItems = (items: FinanceTodo[]) => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      if (sortKey === "title") { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
      else if (sortKey === "todo_type") { av = a.todo_type; bv = b.todo_type; }
      else if (sortKey === "assigned_to") { av = a.assigned_to; bv = b.assigned_to; }
      else if (sortKey === "member_id") { av = a.member_id ?? 0; bv = b.member_id ?? 0; }
      else if (sortKey === "due_date") { av = a.due_date ?? "9999"; bv = b.due_date ?? "9999"; }
      if (av == null || bv == null) return 0;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else { setSortKey(null); setSortDir("asc"); }
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const grouped = useMemo(() => {
    const categoryOrder = ["contributie", "crediteur", "declaratie", "overig"];
    const groups: Record<string, FinanceTodo[]> = {};
    for (const t of pending) {
      const key = getTypeCategory(t.todo_type);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    const sorted: [string, FinanceTodo[]][] = [];
    for (const cat of categoryOrder) {
      if (groups[cat]) sorted.push([cat, sortItems(groups[cat])]);
    }
    return sorted;
  }, [pending, sortKey, sortDir]);

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
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
        onChange={onFileSelected}
      />
      {/* Hold reason dialog */}
      {holdDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-sm font-semibold">Reden voor on hold</h4>
              <p className="text-xs text-muted-foreground">Geef aan waarom deze taak on hold wordt gezet.</p>
              <Textarea
                placeholder="Reden..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="text-sm min-h-[60px]"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setHoldDialogId(null)}>
                  Annuleer
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!holdReason.trim()}
                  onClick={() => {
                    hold.mutate(
                      { id: holdDialogId, reason: holdReason.trim(), notes_by: user?.email || "Onbekend" },
                      { onSuccess: () => { toast.success("On hold gezet"); setHoldDialogId(null); setHoldReason(""); } }
                    );
                  }}
                >
                  On hold zetten
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
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

      {/* Admin Upload Dialog */}
      <AdminUploadDialog
        year={year}
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        onComplete={() => refetch()}
      />

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-sm font-medium">{selectedIds.size} geselecteerd</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              selectedIds.forEach((id) => complete.mutate(id));
              toast.success(`${selectedIds.size} taken afgerond`);
              setSelectedIds(new Set());
            }}
          >
            <CheckCircle2 size={12} />
            Afronden
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => {
              selectedIds.forEach((id) => dismiss.mutate(id));
              toast.success(`${selectedIds.size} taken genegeerd`);
              setSelectedIds(new Set());
            }}
          >
            <X size={12} />
            Negeren
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Deselecteer
          </Button>
        </div>
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
            onClick={() => setShowUploadDialog(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <Upload size={12} />
            Administratie bijwerken
          </Button>
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

      {/* Grouped tables by type category */}
      {grouped.map(([category, items]) => (
        <div key={category} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {typeCategoryLabels[category] || category}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{items.length}</Badge>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm table-fixed">
               <thead>
                <tr className="bg-muted/40 text-xs text-muted-foreground">
                  <th className="w-7 px-2 py-1.5">
                    <Checkbox
                      checked={items.every((t) => selectedIds.has(t.id))}
                      onCheckedChange={(checked) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          items.forEach((t) => checked ? next.add(t.id) : next.delete(t.id));
                          return next;
                        });
                      }}
                    />
                  </th>
                  {([
                    ["title", "Taak", "w-[35%]", "text-left"],
                    ["todo_type", "Type", "w-[100px]", "text-left"],
                    ["assigned_to", "Verantwoordelijke", "w-[110px]", "text-left"],
                    ["member_id", "Lid", "w-[50px]", "text-left"],
                    ["due_date", "Deadline", "w-[75px]", "text-left"],
                  ] as const).map(([key, label, width, align]) => (
                    <th
                      key={key}
                      className={`${align} px-2 py-1.5 font-medium ${width} cursor-pointer select-none hover:text-foreground transition-colors`}
                      onClick={() => toggleSort(key)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {sortKey === key ? (
                          sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                        ) : (
                          <ArrowUpDown size={10} className="opacity-30" />
                        )}
                      </span>
                    </th>
                  ))}
                  <th className="w-[80px] px-2 py-1.5 font-medium text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((todo) => (
                  <tr
                    key={todo.id}
                    className={`hover:bg-muted/20 transition-colors ${selectedIds.has(todo.id) ? "bg-primary/5" : ""}`}
                  >
                    <td className="px-2 py-1.5 align-middle w-7">
                      <Checkbox
                        checked={selectedIds.has(todo.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            checked ? next.add(todo.id) : next.delete(todo.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <span className="text-sm font-medium">{todo.title}</span>
                      <span className="inline-flex items-center gap-2 ml-2 text-[11px] text-muted-foreground">
                        <button onClick={() => toggleNotes(todo.id)} className="hover:text-foreground transition-colors inline-flex items-center gap-0.5">
                          <StickyNote size={9} />
                          {todo.notes ? "Notitie" : "+"}
                        </button>
                        {todo.file_path ? (
                          <button onClick={() => handleDownloadFile(todo.file_path!)} className="hover:text-foreground transition-colors text-primary inline-flex items-center gap-0.5">
                            <FileText size={9} />
                            {todo.file_path.split("/").pop()?.substring(0, 15)}
                          </button>
                        ) : (
                          <button onClick={() => handleFileUpload(todo.id)} className="hover:text-foreground transition-colors inline-flex items-center gap-0.5" disabled={uploadFile.isPending}>
                            <Paperclip size={9} />
                          </button>
                        )}
                      </span>
                      {/* Expanded notes row */}
                      {expandedNotes.has(todo.id) && (
                        <div className="mt-1.5">
                          {todo.notes && editingNoteId !== todo.id && (
                            <div className="text-xs bg-muted/40 rounded p-1.5 mb-1 cursor-pointer hover:bg-muted/60" onClick={() => { setEditingNoteId(todo.id); setNoteText(todo.notes || ""); }}>
                              <span>{todo.notes}</span>
                              {todo.notes_by && <span className="text-muted-foreground italic ml-1">— {todo.notes_by}</span>}
                            </div>
                          )}
                          {(editingNoteId === todo.id || !todo.notes) && (
                            <div className="flex gap-1">
                              <Textarea placeholder="Notitie..." value={editingNoteId === todo.id ? noteText : ""} onChange={(e) => { if (editingNoteId !== todo.id) setEditingNoteId(todo.id); setNoteText(e.target.value); }} onFocus={() => { if (editingNoteId !== todo.id) { setEditingNoteId(todo.id); setNoteText(todo.notes || ""); } }} className="text-xs min-h-[36px] flex-1" rows={1} />
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleSaveNote(todo.id)} disabled={!noteText.trim() && !todo.notes}><Send size={10} /></Button>
                              {editingNoteId === todo.id && <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingNoteId(null); setNoteText(""); }}><X size={10} /></Button>}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <Badge className={`text-[10px] px-1.5 py-0 ${typeColors[todo.todo_type] || typeColors.manual}`}>
                        {typeLabels[todo.todo_type] || todo.todo_type}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 align-middle text-xs">
                      {assigneeLabels[todo.assigned_to] || todo.assigned_to}
                    </td>
                    <td className="px-2 py-1.5 align-middle text-xs text-muted-foreground tabular-nums">
                      {todo.member_id ? `#${todo.member_id}` : "—"}
                    </td>
                    <td className="px-2 py-1.5 align-middle text-xs text-muted-foreground">
                      {fmtDate(todo.due_date) || "—"}
                    </td>
                    <td className="px-2 py-1.5 align-middle">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => complete.mutate(todo.id, { onSuccess: () => toast.success("Taak afgerond") })} className="p-1 text-muted-foreground hover:text-green-600" title="Afronden"><CheckCircle2 size={13} /></button>
                        <button onClick={() => { setHoldDialogId(todo.id); setHoldReason(""); }} className="p-1 text-muted-foreground hover:text-amber-600" title="On hold"><PauseCircle size={13} /></button>
                        <button onClick={() => dismiss.mutate(todo.id, { onSuccess: () => toast.success("Genegeerd") })} className="p-1 text-muted-foreground hover:text-destructive" title="Negeren"><X size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
