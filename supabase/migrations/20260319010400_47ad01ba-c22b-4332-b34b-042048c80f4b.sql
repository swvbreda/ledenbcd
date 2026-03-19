
CREATE TYPE public.edit_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.member_edit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status edit_request_status NOT NULL DEFAULT 'pending',
  submitted_by uuid NOT NULL,
  reviewed_by uuid,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.member_edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can submit edit requests for own profile"
ON public.member_edit_requests
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND member_id = (
    SELECT mp.member_id FROM public.member_profiles mp WHERE mp.user_id = auth.uid() LIMIT 1
  )
);

CREATE POLICY "Members can view own edit requests"
ON public.member_edit_requests
FOR SELECT
TO authenticated
USING (
  submitted_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update edit requests"
ON public.member_edit_requests
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete edit requests"
ON public.member_edit_requests
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
