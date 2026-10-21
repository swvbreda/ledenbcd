import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { diffLinks, type DossierLink, type FinanceAlias, type RegisterDossier } from "@/lib/dossierRegister";

const db = supabase as any;

/** Dossierregister + aliases + projectkoppelingen. Alleen voor beheerders (RLS). */
export function useDossierRegister(enabled: boolean, live?: { refetchInterval: number }) {
  const liveOpts = live ? { refetchOnWindowFocus: true, staleTime: 0, refetchInterval: live.refetchInterval, refetchIntervalInBackground: false } : {};
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const dossiers = useQuery({
    queryKey: ["dossier-register", uid], enabled: enabled && !!uid,
    queryFn: async () => {
      const { data, error } = await db.from("dossier_register").select("id,parent_id,name,sort_order,jaarplan_kind,jaarplan_section,jaarplan_pages,note,archived_at,project_hidden_at,status_summary,status_date").order("sort_order");
      if (error) throw error;
      return data as RegisterDossier[];
    },
  });
  const aliases = useQuery({
    queryKey: ["dossier-aliases"], enabled,
    queryFn: async () => {
      const { data, error } = await db.from("dossier_finance_aliases").select("dossier_id,label");
      if (error) throw error;
      return data as FinanceAlias[];
    },
  });
  const links = useQuery({
    queryKey: ["dossier-links"], enabled,
    queryFn: async () => {
      const { data, error } = await db.from("dossier_project_links").select("dossier_id,project_id");
      if (error) throw error;
      return data as DossierLink[];
    },
  });
  return {
    dossiers: dossiers.data ?? [], aliases: aliases.data ?? [], links: links.data ?? [],
    isLoading: dossiers.isLoading || aliases.isLoading || links.isLoading,
    error: dossiers.error || aliases.error || links.error,
  };
}

/** Zet de dossierkoppelingen van een project (omkeerbaar; audit server-side). */
export function useSetProjectDossiers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, current, next }: { projectId: string; current: string[]; next: string[] }) => {
      const { add, remove } = diffLinks(current, next);
      if (add.length) {
        const { error } = await db.from("dossier_project_links").insert(add.map((dossier_id) => ({ dossier_id, project_id: projectId })));
        if (error) throw error;
      }
      if (remove.length) {
        const { error } = await db.from("dossier_project_links").delete().eq("project_id", projectId).in("dossier_id", remove);
        if (error) throw error;
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["dossier-links"] });
      qc.invalidateQueries({ queryKey: ["project-events"] });
    },
  });
}

/** Verbergt/terugzet een dossier alleen in het Projecten-overzicht; wijzigt uitsluitend project_hidden_at. */
export async function setDossierProjectHidden(dbc: any, id: string, hide: boolean, now: () => string = () => new Date().toISOString()) {
  const { data, error } = await dbc.from("dossier_register").update({ project_hidden_at: hide ? now() : null }).eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Geen toegang");
}

export function useSetDossierProjectHidden() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, hide }: { id: string; hide: boolean }) => setDossierProjectHidden(db, id, hide),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dossier-register"] }),
  });
}

/** Slaat de handmatige algemene dossierstatus op (alleen status_summary/status_date) en leest terug. */
export async function setDossierStatus(dbc: any, id: string, summary: string, date: string) {
  const status_summary = summary.trim() || null;
  const status_date = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const { data, error } = await dbc.from("dossier_register").update({ status_summary, status_date }).eq("id", id).select("id,status_summary,status_date");
  if (error) throw error;
  if (!data?.length) throw new Error("Geen toegang");
  return data[0] as { id: string; status_summary: string | null; status_date: string | null };
}

export function useSetDossierStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, summary, date }: { id: string; summary: string; date: string }) => setDossierStatus(db, id, summary, date),
    onSettled: () => qc.invalidateQueries({ queryKey: ["dossier-register"] }),
  });
}
