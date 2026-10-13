import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { diffLinks, type DossierLink, type FinanceAlias, type RegisterDossier } from "@/lib/dossierRegister";

const db = supabase as any;

/** Dossierregister + aliases + projectkoppelingen. Alleen voor beheerders (RLS). */
export function useDossierRegister(enabled: boolean) {
  const dossiers = useQuery({
    queryKey: ["dossier-register"], enabled,
    queryFn: async () => {
      const { data, error } = await db.from("dossier_register").select("id,parent_id,name,sort_order,jaarplan_kind,jaarplan_section,jaarplan_pages,note,archived_at").order("sort_order");
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
