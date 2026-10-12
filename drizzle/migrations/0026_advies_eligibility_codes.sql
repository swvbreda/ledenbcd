CREATE TABLE public.advies_eligibility_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  code_challenge text NOT NULL CHECK (code_challenge ~ '^[A-Za-z0-9_-]{43}$'),
  audience text NOT NULL,
  user_id uuid NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advies_eligibility_codes_user_created_idx ON public.advies_eligibility_codes (user_id, created_at);
REVOKE ALL ON public.advies_eligibility_codes FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advies_eligibility_codes TO service_role;
ALTER TABLE public.advies_eligibility_codes ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.advies_eligibility_codes IS 'Service-only: one-time PKCE eligibility codes for Het Strategiebureau. Stores only SHA-256 hashes; no policies by design.';

CREATE TABLE public.advies_eligibility_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('issue','redeem')),
  subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX advies_eligibility_attempts_lookup_idx ON public.advies_eligibility_attempts (kind, subject_hash, created_at);
REVOKE ALL ON public.advies_eligibility_attempts FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.advies_eligibility_attempts TO service_role;
ALTER TABLE public.advies_eligibility_attempts ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.advies_eligibility_attempts IS 'Service-only rate-limit ledger (hashed subjects) for advies eligibility codes.';

-- Records an attempt and returns true when under the limit (atomic per call).
CREATE OR REPLACE FUNCTION public.advies_rate_limit(_kind text, _subject_hash text, _max integer, _window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('advies:' || _kind || ':' || _subject_hash));
  DELETE FROM advies_eligibility_attempts WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO n FROM advies_eligibility_attempts
   WHERE kind = _kind AND subject_hash = _subject_hash
     AND created_at > now() - make_interval(secs => _window_seconds);
  IF n >= _max THEN RETURN false; END IF;
  INSERT INTO advies_eligibility_attempts(kind, subject_hash) VALUES (_kind, _subject_hash);
  RETURN true;
END $$;

-- Current membership: any own member_profiles link to a members_data row with member_type 'member'.
CREATE OR REPLACE FUNCTION public.advies_is_current_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM member_profiles mp JOIN members_data md ON md.id = mp.member_id
    WHERE mp.user_id = _user_id AND md.member_type = 'member'
  )
$$;

-- Atomic single use: marks consumed and returns the row only once, only if unexpired and for this audience.
CREATE OR REPLACE FUNCTION public.advies_consume_code(_code_hash text, _audience text)
RETURNS TABLE(user_id uuid, code_challenge text) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE advies_eligibility_codes c SET consumed_at = now()
   WHERE c.code_hash = _code_hash AND c.audience = _audience
     AND c.consumed_at IS NULL AND c.expires_at > now()
  RETURNING c.user_id, c.code_challenge
$$;

REVOKE ALL ON FUNCTION public.advies_rate_limit(text,text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advies_is_current_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advies_consume_code(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advies_rate_limit(text,text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.advies_is_current_member(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.advies_consume_code(text,text) TO service_role;