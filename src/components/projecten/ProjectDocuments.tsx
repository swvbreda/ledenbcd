import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Archive, ExternalLink, FileText, Loader2, Upload } from "lucide-react";
import { displayName, type StaffMember } from "@/lib/projectWorkspace";
import { DOCUMENT_ACCEPT, DOCUMENT_BUCKET, DOC_TYPE_LABEL, documentPath, sha256Hex, validateDocumentFile, type DocType } from "@/lib/projectDocuments";

const db = supabase as any;
type Doc = {
  id: string; project_id: string; title: string; doc_type: DocType; document_date: string | null; original_filename: string;
  size_bytes: number; mime_type: string; sha256: string; object_path: string; uploaded_by: string | null; created_at: string; archived_at: string | null;
};
const errMsg = (e: unknown) => (e instanceof Error ? e.message : (e as any)?.message ?? "Onbekende fout");
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toLocaleString("nl-NL", { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);
const SIGNED_SECONDS = 300;

export function ProjectDocuments({ projectId, staff }: { projectId: string; staff: StaffMember[] }) {
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const docsQ = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: async () => {
      const { data, error } = await db.from("internal_project_documents").select("*").eq("project_id", projectId)
        .order("document_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Doc[];
    },
  });
  const docs = (docsQ.data ?? []).filter((d) => showArchived || !d.archived_at);
  // Kortdurende ondertekende links (privébucket); vervallen na 5 minuten en worden daarvoor ververst.
  const urlsQ = useQuery({
    queryKey: ["project-document-urls", projectId, docs.map((d) => d.object_path).join(",")],
    enabled: docs.length > 0,
    staleTime: (SIGNED_SECONDS - 60) * 1000,
    refetchInterval: (SIGNED_SECONDS - 60) * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(DOCUMENT_BUCKET).createSignedUrls(docs.map((d) => d.object_path), SIGNED_SECONDS);
      if (error) throw error;
      return Object.fromEntries((data ?? []).filter((x) => x.signedUrl && x.path).map((x) => [x.path as string, x.signedUrl]));
    },
  });

  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: "", doc_type: "gespreksverslag" as DocType, document_date: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Kies een bestand");
      const title = form.title.trim();
      if (!title) throw new Error("Titel is verplicht");
      const v = validateDocumentFile(file);
      if ("error" in v) throw new Error(v.error);
      const bytes = await file.arrayBuffer();
      const hash = await sha256Hex(bytes);
      const { data: dup, error: dupErr } = await db.from("internal_project_documents").select("id,title").eq("project_id", projectId).eq("sha256", hash).maybeSingle();
      if (dupErr) throw dupErr;
      if (dup) throw new Error(`Dit bestand staat al in het project als “${dup.title}”`);
      const path = documentPath(projectId, hash, v.ext);
      const { error: upErr } = await supabase.storage.from(DOCUMENT_BUCKET).upload(path, new Blob([bytes], { type: v.mime }), { contentType: v.mime, upsert: false });
      // Bestaat het object al (eerdere onderbroken registratie)? Zelfde hash = zelfde bytes; alleen registreren.
      if (upErr && !/exists|duplicate/i.test(upErr.message)) throw upErr;
      const { data, error } = await db.from("internal_project_documents").insert({
        project_id: projectId, title, doc_type: form.doc_type, document_date: form.document_date || null,
        original_filename: file.name, size_bytes: file.size, mime_type: v.mime, sha256: hash, object_path: path,
      }).select("id").single();
      if (error) throw error;
      const { data: back, error: backErr } = await db.from("internal_project_documents").select("id").eq("id", data.id).maybeSingle();
      if (backErr || !back) throw new Error("Document niet teruggelezen na opslaan");
    },
    onSuccess: () => {
      toast.success("Document opgeslagen in project");
      setFile(null); setForm({ title: "", doc_type: "gespreksverslag", document_date: "" });
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });
      qc.invalidateQueries({ queryKey: ["project-events"] });
    },
    onError: (e) => toast.error("Uploaden mislukt: " + errMsg(e)),
  });
  const archive = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { data, error } = await db.from("internal_project_documents").update({ archived_at: on ? new Date().toISOString() : null }).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Geen toegang");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project-documents", projectId] }); qc.invalidateQueries({ queryKey: ["project-events"] }); },
    onError: (e) => toast.error("Archiveren mislukt: " + errMsg(e)),
  });

  const activeCount = (docsQ.data ?? []).filter((d) => !d.archived_at).length;
  const name = (id: string | null) => (id ? displayName(staff.find((s) => s.user_id === id)) : "Niet geregistreerd");

  return (
    <section className="space-y-4 min-w-0">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-medium">Documenten ({activeCount})</h3>
        <label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} />Toon gearchiveerd</label>
      </div>
      {docsQ.isLoading ? <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Laden...</p>
        : docsQ.error ? <p className="text-sm text-destructive">Documenten laden mislukt: {errMsg(docsQ.error)}</p>
        : docs.length === 0 ? <p className="text-sm text-muted-foreground">Nog geen documenten.</p> : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {docs.map((d) => {
              const url = urlsQ.data?.[d.object_path];
              return (
                <li key={d.id} className={`flex flex-wrap items-start gap-3 p-3 ${d.archived_at ? "opacity-60" : ""}`}>
                  <FileText className="h-5 w-5 text-brand-red shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-words">{d.title}</p>
                    <p className="text-xs text-muted-foreground break-words">
                      {DOC_TYPE_LABEL[d.doc_type]}{d.document_date ? ` · ${d.document_date}` : ""} · {d.original_filename} · {kb(d.size_bytes)}
                    </p>
                    <p className="text-xs text-muted-foreground">Toegevoegd door {name(d.uploaded_by)} op {new Date(d.created_at).toLocaleDateString("nl-NL")}{d.archived_at ? " · gearchiveerd" : ""}</p>
                  </div>
                  <div className="flex gap-2">
                    {url ? (
                      <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-1" />Openen</a></Button>
                    ) : <Button size="sm" variant="outline" disabled>{urlsQ.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Niet beschikbaar"}</Button>}
                    <Button size="sm" variant="ghost" disabled={archive.isPending} onClick={() => {
                      if (d.archived_at || window.confirm(`“${d.title}” archiveren? Het bestand blijft bewaard.`)) archive.mutate({ id: d.id, on: !d.archived_at });
                    }}><Archive className="h-4 w-4 mr-1" />{d.archived_at ? "Terugzetten" : "Archiveren"}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

      <form className="rounded-md border border-border p-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!upload.isPending) upload.mutate(); }}>
        <h4 className="text-sm font-medium">Document toevoegen</h4>
        <div><Label htmlFor="doc-file">Bestand (PDF, DOCX of XLSX, max. 20 MB)</Label>
          <Input id="doc-file" ref={fileRef} type="file" accept={DOCUMENT_ACCEPT} onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            if (f && !form.title.trim()) setForm((x) => ({ ...x, title: f.name.replace(/\.[^.]+$/, "") }));
            if (f) { const v = validateDocumentFile(f); if ("error" in v) toast.error(v.error); }
          }} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr,12rem,12rem] gap-3">
          <div><Label htmlFor="doc-title">Titel</Label><Input id="doc-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v as DocType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((k) => <SelectItem key={k} value={k}>{DOC_TYPE_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label htmlFor="doc-date">Documentdatum (optioneel)</Label><Input id="doc-date" type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} /></div>
        </div>
        <Button type="submit" disabled={upload.isPending || !file}>{upload.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}Opslaan in project</Button>
      </form>
    </section>
  );
}
