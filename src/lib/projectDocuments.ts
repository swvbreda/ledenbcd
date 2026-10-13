export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_BUCKET = "project-documents";
export type DocType = "gespreksverslag" | "brief" | "overig";
export const DOC_TYPE_LABEL: Record<DocType, string> = { gespreksverslag: "Gespreksverslag", brief: "Brief", overig: "Overig" };

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
export const DOCUMENT_ACCEPT = ".pdf,.docx,.xlsx," + Object.values(MIME).join(",");

/** Alleen PDF/DOCX/XLSX tot 20 MB; extensie bepaalt het type, een afwijkend browsertype wordt geweigerd. */
export function validateDocumentFile(f: { name: string; type: string; size: number }): { ext: string; mime: string } | { error: string } {
  const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = MIME[ext];
  if (!mime || !f.name.includes(".")) return { error: "Alleen PDF-, DOCX- of XLSX-bestanden zijn toegestaan" };
  if (f.type && f.type !== mime && f.type !== "application/octet-stream") return { error: "Bestandstype komt niet overeen met de extensie" };
  if (f.size <= 0) return { error: "Bestand is leeg" };
  if (f.size > MAX_DOCUMENT_BYTES) return { error: "Bestand is groter dan 20 MB" };
  return { ext, mime };
}

export const documentPath = (projectId: string, sha256: string, ext: string) => `${projectId}/${sha256}.${ext}`;

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
