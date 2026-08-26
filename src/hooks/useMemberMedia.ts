import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LOGO_BUCKET = "member-logos";
export const CONTACT_BUCKET = "contact-photos";

export const contactSlug = (naam: string) =>
  naam
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const extOf = (file: File) => {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return file.type.split("/")[1] || "jpg";
};

export const validateImage = (file: File): string | null => {
  if (!file.type.startsWith("image/")) return "Alleen afbeeldingen zijn toegestaan";
  if (file.size > 5 * 1024 * 1024) return "De afbeelding mag maximaal 5 MB zijn";
  return null;
};

/** Haalt alle bestanden in een map op en maakt er signed URL's van, gekeyed op bestandsnaam zonder extensie. */
async function loadFolder(bucket: string, memberId: number): Promise<Record<string, string>> {
  const { data, error } = await supabase.storage.from(bucket).list(String(memberId), { limit: 200 });
  if (error || !data) return {};
  const files = data.filter((f) => f.id);
  if (files.length === 0) return {};
  const { data: signed } = await supabase.storage
    .from(bucket)
    .createSignedUrls(files.map((f) => `${memberId}/${f.name}`), 3600);
  const map: Record<string, string> = {};
  (signed || []).forEach((s) => {
    if (!s.signedUrl || !s.path) return;
    const base = s.path.split("/").pop()!.replace(/\.[^.]+$/, "");
    map[base] = s.signedUrl;
  });
  return map;
}

async function replaceFile(bucket: string, memberId: number, base: string, file: File) {
  const { data: existing } = await supabase.storage.from(bucket).list(String(memberId), { limit: 200 });
  const stale = (existing || [])
    .filter((f) => f.id && f.name.replace(/\.[^.]+$/, "") === base)
    .map((f) => `${memberId}/${f.name}`);
  if (stale.length) await supabase.storage.from(bucket).remove(stale);

  const path = `${memberId}/${base}.${extOf(file)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
}

async function removeFile(bucket: string, memberId: number, base: string) {
  const { data: existing } = await supabase.storage.from(bucket).list(String(memberId), { limit: 200 });
  const paths = (existing || [])
    .filter((f) => f.id && f.name.replace(/\.[^.]+$/, "") === base)
    .map((f) => `${memberId}/${f.name}`);
  if (paths.length) {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}

/** Logo van een lid (één per lid). */
export function useMemberLogo(memberId: number | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["member-logo", memberId],
    queryFn: async () => (await loadFolder(LOGO_BUCKET, memberId!))["logo"] ?? null,
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["member-logo", memberId] });
    queryClient.invalidateQueries({ queryKey: ["member-logos-bulk"] });
  };

  return {
    logoUrl: query.data ?? null,
    isLoading: query.isLoading,
    uploadLogo: async (file: File) => {
      await replaceFile(LOGO_BUCKET, memberId!, "logo", file);
      invalidate();
    },
    removeLogo: async () => {
      await removeFile(LOGO_BUCKET, memberId!, "logo");
      invalidate();
    },
  };
}

/** Foto's van alle contactpersonen van een lid, gekeyed op contactSlug(naam). */
export function useContactPhotos(memberId: number | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["contact-photos", memberId],
    queryFn: () => loadFolder(CONTACT_BUCKET, memberId!),
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["contact-photos", memberId] });

  return {
    photos: query.data ?? {},
    isLoading: query.isLoading,
    uploadPhoto: async (naam: string, file: File) => {
      await replaceFile(CONTACT_BUCKET, memberId!, contactSlug(naam), file);
      invalidate();
    },
    removePhoto: async (naam: string) => {
      await removeFile(CONTACT_BUCKET, memberId!, contactSlug(naam));
      invalidate();
    },
  };
}

/** Logo's van meerdere leden tegelijk (voor lijsten). */
export function useMemberLogosBulk(memberIds: number[]) {
  const key = [...memberIds].sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: ["member-logos-bulk", key],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(LOGO_BUCKET).list("", { limit: 1000 });
      if (error || !data) return {} as Record<number, string>;
      const folders = data.filter((f) => !f.id).map((f) => f.name);
      const wanted = new Set(memberIds.map(String));
      const paths: string[] = [];
      for (const folder of folders) {
        if (!wanted.has(folder)) continue;
        const { data: files } = await supabase.storage.from(LOGO_BUCKET).list(folder, { limit: 10 });
        const logo = (files || []).find((f) => f.id && f.name.startsWith("logo."));
        if (logo) paths.push(`${folder}/${logo.name}`);
      }
      if (paths.length === 0) return {} as Record<number, string>;
      const { data: signed } = await supabase.storage.from(LOGO_BUCKET).createSignedUrls(paths, 3600);
      const map: Record<number, string> = {};
      (signed || []).forEach((s) => {
        if (!s.signedUrl || !s.path) return;
        const id = Number(s.path.split("/")[0]);
        if (!Number.isNaN(id)) map[id] = s.signedUrl;
      });
      return map;
    },
    enabled: memberIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Contactfoto's van meerdere leden tegelijk: { memberId: { slug: url } }. */
export function useContactPhotosBulk(memberIds: number[]) {
  const key = [...new Set(memberIds)].sort((a, b) => a - b).join(",");
  return useQuery({
    queryKey: ["contact-photos-bulk", key],
    queryFn: async () => {
      const ids = [...new Set(memberIds)];
      const result: Record<number, Record<string, string>> = {};
      for (const id of ids) {
        const folder = await loadFolder(CONTACT_BUCKET, id);
        if (Object.keys(folder).length) result[id] = folder;
      }
      return result;
    },
    enabled: memberIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
