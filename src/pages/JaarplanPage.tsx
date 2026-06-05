import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { supabase } from "@/integrations/supabase/client";
import SecurePdfViewer from "@/components/SecurePdfViewer";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const SLUG = "jaarplan";

export default function JaarplanPage() {
  const { user, isAdmin } = useAuth();
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [title, setTitle] = useState<string>("Jaarplan");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [meta, setMeta] = useState<{ uploaded_at: string; file_size_bytes: number | null } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPdfData(null);
    (async () => {
      // Fetch metadata first to know if a doc exists
      const { data: docRow } = await supabase
        .from("secure_documents")
        .select("title, uploaded_at, file_size_bytes")
        .eq("slug", SLUG)
        .maybeSingle();

      if (cancelled) return;

      if (!docRow) {
        setLoading(false);
        return;
      }

      setTitle(docRow.title);
      setMeta({ uploaded_at: docRow.uploaded_at, file_size_bytes: docRow.file_size_bytes });

      const { data, error } = await invokeWithAuth<{ url: string; title: string }>(
        "get-secure-document-url",
        { body: { slug: SLUG } },
      );
      if (cancelled) return;
      if (error || !data?.url) {
        toast.error(error?.message ?? "Kon document niet laden");
        setLoading(false);
        return;
      }
      // Fetch the PDF bytes ourselves so the signed URL never reaches the DOM
      try {
        const res = await fetch(data.url);
        if (!res.ok) throw new Error("Kon document niet ophalen");
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        setPdfData(new Uint8Array(buf));
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message ?? "Kon document niet ophalen");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Activate native screenshot blocker if running in Capacitor
  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        // Best-effort: use PrivacyScreen plugin if available at runtime
        const plugin = (Capacitor as any).Plugins?.PrivacyScreen;
        if (plugin?.enable) {
          await plugin.enable();
          cleanup = () => { plugin.disable?.(); };
        }
      } catch {}
    })();
    return () => cleanup();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Alleen PDF-bestanden");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Bestand te groot (max 25MB)");
      return;
    }
    setUploading(true);
    try {
      const path = `${SLUG}/${SLUG}-${Date.now()}.pdf`;

      // Remove old file if exists
      const { data: existing } = await supabase
        .from("secure_documents")
        .select("storage_path")
        .eq("slug", SLUG)
        .maybeSingle();

      const { error: upErr } = await supabase.storage
        .from("secure-documents")
        .upload(path, file, { contentType: "application/pdf", upsert: true });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase
        .from("secure_documents")
        .upsert(
          {
            slug: SLUG,
            title: "Jaarplan",
            storage_path: path,
            uploaded_by: user.id,
            uploaded_at: new Date().toISOString(),
            file_size_bytes: file.size,
          },
          { onConflict: "slug" },
        );
      if (dbErr) throw dbErr;

      if (existing?.storage_path && existing.storage_path !== path) {
        await supabase.storage.from("secure-documents").remove([existing.storage_path]);
      }

      toast.success("Jaarplan geüpload");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.message ?? "Upload mislukt");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <BcdHeroBanner title={title} subtitle="Vertrouwelijk – alleen ter inzage" />

      {isAdmin && (
        <div className="border-2 border-primary/60 rounded-md p-4 bg-card">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm">
              <p className="font-medium">Beheer jaarplan</p>
              {meta ? (
                <p className="text-xs text-muted-foreground">
                  Laatst geüpload: {new Date(meta.uploaded_at).toLocaleString("nl-NL")}
                  {meta.file_size_bytes ? ` · ${(meta.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Nog geen jaarplan geüpload.</p>
              )}
            </div>
            <label className="inline-flex">
              <Button asChild size="sm" disabled={uploading}>
                <span className="cursor-pointer inline-flex items-center gap-2">
                  {uploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                  {meta ? "Vervangen" : "Uploaden"}
                </span>
              </Button>
              <Input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-brand-red" size={32} />
        </div>
      ) : !pdfData ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Er is nog geen jaarplan beschikbaar.
        </div>
      ) : (
        <SecurePdfViewer data={pdfData} />
      )}
    </div>
  );
}