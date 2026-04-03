
-- Table to store WebAuthn/Passkey credentials
CREATE TABLE public.passkey_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_name text,
  transports text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.passkey_credentials ENABLE ROW LEVEL SECURITY;

-- Users can read their own passkeys
CREATE POLICY "Users can read own passkeys"
  ON public.passkey_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own passkeys
CREATE POLICY "Users can delete own passkeys"
  ON public.passkey_credentials FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can insert (from edge function)
CREATE POLICY "Service can insert passkeys"
  ON public.passkey_credentials FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

-- Service role can update counter
CREATE POLICY "Service can update passkeys"
  ON public.passkey_credentials FOR UPDATE
  TO public
  USING (auth.role() = 'service_role');

-- Admins can read all
CREATE POLICY "Admins can read all passkeys"
  ON public.passkey_credentials FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Index for fast lookup by credential_id
CREATE INDEX idx_passkey_credential_id ON public.passkey_credentials(credential_id);
CREATE INDEX idx_passkey_user_id ON public.passkey_credentials(user_id);
