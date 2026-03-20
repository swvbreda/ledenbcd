
-- Table for storing iOS push device tokens
CREATE TABLE public.push_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_token)
);

ALTER TABLE public.push_device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can insert their own tokens
CREATE POLICY "Users can insert own device tokens"
  ON public.push_device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own tokens
CREATE POLICY "Users can read own device tokens"
  ON public.push_device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Users can delete their own tokens
CREATE POLICY "Users can delete own device tokens"
  ON public.push_device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY "Users can update own device tokens"
  ON public.push_device_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
