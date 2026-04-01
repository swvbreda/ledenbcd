import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { GalleryImage } from "@/components/BenefitGallery";

export function useBenefitImages(benefitId: string | undefined) {
  return useQuery({
    queryKey: ["benefit-images", benefitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("benefit_images")
        .select("*")
        .eq("benefit_id", benefitId!)
        .order("sort_order");
      if (error) throw error;
      return data as GalleryImage[];
    },
    enabled: !!benefitId,
  });
}

export function useBenefitImageMutations(benefitId: string | undefined) {
  const qc = useQueryClient();
  const key = ["benefit-images", benefitId];

  const addImage = useMutation({
    mutationFn: async ({ file, sort_order, caption }: { file: File; sort_order: number; caption?: string }) => {
      const ext = file.name.split(".").pop();
      const path = `${benefitId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("benefit-images").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { error } = await supabase
        .from("benefit_images")
        .insert({ benefit_id: benefitId!, image_path: path, sort_order, caption: caption || null });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const removeImage = useMutation({
    mutationFn: async ({ id, image_path }: { id: string; image_path: string }) => {
      await supabase.storage.from("benefit-images").remove([image_path]);
      const { error } = await supabase.from("benefit_images").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { addImage, removeImage };
}
