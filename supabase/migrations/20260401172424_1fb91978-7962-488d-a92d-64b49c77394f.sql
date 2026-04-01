-- Create member_benefits table
CREATE TABLE public.member_benefits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Overig',
  provider_name text,
  provider_url text,
  image_path text,
  discount_info text,
  contact_email text,
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_benefits ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active benefits
CREATE POLICY "Authenticated can read active benefits"
ON public.member_benefits
FOR SELECT
TO authenticated
USING (active = true OR has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert
CREATE POLICY "Admins can insert benefits"
ON public.member_benefits
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update benefits"
ON public.member_benefits
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete benefits"
ON public.member_benefits
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for benefit images
INSERT INTO storage.buckets (id, name, public) VALUES ('benefit-images', 'benefit-images', true);

-- Public read access for benefit images
CREATE POLICY "Benefit images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'benefit-images');

-- Admins can upload benefit images
CREATE POLICY "Admins can upload benefit images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'benefit-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can update benefit images
CREATE POLICY "Admins can update benefit images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'benefit-images' AND public.has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete benefit images
CREATE POLICY "Admins can delete benefit images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'benefit-images' AND public.has_role(auth.uid(), 'admin'::app_role));