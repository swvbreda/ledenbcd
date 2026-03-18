
-- Table to store member edits (JSON patches over base data)
CREATE TABLE public.member_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id INTEGER NOT NULL UNIQUE,
  data JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES auth.users(id) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_edits ENABLE ROW LEVEL SECURITY;

-- Admins can read all edits
CREATE POLICY "Admins can read member edits"
ON public.member_edits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert edits
CREATE POLICY "Admins can insert member edits"
ON public.member_edits
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update edits
CREATE POLICY "Admins can update member edits"
ON public.member_edits
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
