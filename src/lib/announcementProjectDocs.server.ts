import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Copies a published announcement's PDF attachment into the documents of every
 * project the announcement was automatically linked to. Project documents only
 * accept PDF/DOCX/XLSX, so photos stay on the announcement. Idempotent via the
 * (project_id, sha256) unique key; failures never affect the announcement.
 */
export async function copyAttachmentToProjects(admin: SupabaseClient, storagePath: string) {
  const { data: att } = await admin.from("member_announcement_attachments")
    .select("announcement_id, mime_type, file_name, size_bytes, sha256")
    .eq("storage_path", storagePath).maybeSingle();
  if (!att || att.mime_type !== "application/pdf") return;
  const { data: links } = await admin.from("announcement_project_links")
    .select("project_id").eq("announcement_id", att.announcement_id);
  if (!links?.length) return;
  const { data: ann } = await admin.from("member_announcements")
    .select("title, published_at").eq("id", att.announcement_id).maybeSingle();
  const file = await admin.storage.from("announcement-media").download(storagePath);
  if (file.error || !file.data) return;
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  for (const { project_id } of links) {
    const objectPath = `${project_id}/${att.sha256}.pdf`;
    const up = await admin.storage.from("project-documents")
      .upload(objectPath, bytes, { contentType: "application/pdf", upsert: false });
    if (up.error && !/exists|duplicate/i.test(up.error.message)) continue;
    await admin.from("internal_project_documents").upsert({
      project_id,
      title: (ann?.title ?? att.file_name ?? "Aankondiging").slice(0, 300),
      doc_type: "overig",
      document_date: ann?.published_at ? ann.published_at.slice(0, 10) : null,
      original_filename: (att.file_name ?? "aankondiging.pdf").slice(0, 300),
      size_bytes: att.size_bytes,
      mime_type: "application/pdf",
      sha256: att.sha256,
      object_path: objectPath,
    }, { onConflict: "project_id,sha256", ignoreDuplicates: true });
  }
}
