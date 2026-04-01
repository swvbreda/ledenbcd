
CREATE TABLE public.benefit_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  benefit_id UUID NOT NULL REFERENCES public.member_benefits(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.benefit_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read benefit images"
  ON public.benefit_images FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert benefit images"
  ON public.benefit_images FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update benefit images"
  ON public.benefit_images FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete benefit images"
  ON public.benefit_images FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_benefit_images_benefit_id ON public.benefit_images(benefit_id);
