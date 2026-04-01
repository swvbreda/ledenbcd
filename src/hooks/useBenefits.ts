import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Benefit {
  id: string;
  title: string;
  description: string | null;
  category: string;
  provider_name: string | null;
  provider_url: string | null;
  image_path: string | null;
  discount_info: string | null;
  contact_email: string | null;
  detail_content: string | null;
  featured: boolean;
  active: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type BenefitInsert = Omit<Benefit, "id" | "created_at" | "updated_at">;

export function useBenefits() {
  return useQuery({
    queryKey: ["benefits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_benefits" as any)
        .select("*")
        .order("featured", { ascending: false })
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Benefit[];
    },
  });
}

export function useBenefitMutations() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const upsert = useMutation({
    mutationFn: async (benefit: Partial<Benefit> & { title: string; category: string }) => {
      const payload = { ...benefit, created_by: benefit.created_by || user?.id };
      if (benefit.id) {
        const { error } = await supabase
          .from("member_benefits" as any)
          .update(payload as any)
          .eq("id", benefit.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("member_benefits" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["benefits"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("member_benefits" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["benefits"] }),
  });

  return { upsert, remove };
}

export function getBenefitImageUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from("benefit-images").getPublicUrl(path);
  return data.publicUrl;
}
