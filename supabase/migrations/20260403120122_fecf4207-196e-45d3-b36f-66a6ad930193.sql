
CREATE TABLE public.mfa_email_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mfa_email_codes ENABLE ROW LEVEL SECURITY;

-- Edge function uses service role key, so no user-facing policies needed
-- But add a cleanup index for performance
CREATE INDEX idx_mfa_email_codes_user_lookup ON public.mfa_email_codes (user_id, used, expires_at);

-- Function to clean up expired codes (called by edge function)
CREATE OR REPLACE FUNCTION public.cleanup_expired_mfa_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.mfa_email_codes
  WHERE expires_at < now() - interval '1 hour';
$$;
