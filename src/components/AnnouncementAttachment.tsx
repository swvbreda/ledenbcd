import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Attachment { storage_path: string; mime_type: string; file_name: string | null }

/** Shows a stored WhatsApp attachment via a short-lived signed link (RLS-checked). */
export function AnnouncementAttachment({ announcementId }: { announcementId: string }) {
  const { data } = useQuery({
    queryKey: ["announcement-attachment", announcementId],
    queryFn: async () => {
      const { data: row, error } = await supabase
        .from("member_announcement_attachments" as never)
        .select("storage_path,mime_type,file_name")
        .eq("announcement_id", announcementId)
        .maybeSingle();
      if (error || !row) return null;
      const att = row as unknown as Attachment;
      const signed = await supabase.storage.from("announcement-media").createSignedUrl(att.storage_path, 3600);
      if (signed.error) return null;
      return { ...att, url: signed.data.signedUrl };
    },
    staleTime: 30 * 60 * 1000,
  });
  if (!data) return null;
  if (data.mime_type.startsWith("image/")) {
    return (
      <a href={data.url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={data.url} alt="Bijlage bij aankondiging" loading="lazy"
          className="max-h-96 w-auto max-w-full rounded-md border" />
      </a>
    );
  }
  return (
    <a href={data.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
      <FileText className="h-4 w-4 text-brand-red" /> {data.file_name || "PDF openen"}
    </a>
  );
}
