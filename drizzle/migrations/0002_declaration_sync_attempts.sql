CREATE OR REPLACE FUNCTION public.is_treasurer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members b
    JOIN auth.users u ON u.id = _user_id
    WHERE b.functie ILIKE '%penningmeester%'
      AND lower(u.email) IN (lower(coalesce(b.email, '')), lower(coalesce(b.bond_email, '')))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_treasurer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_treasurer(uuid) TO authenticated, service_role;

CREATE TABLE public.internal_declaration_sync_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  declaration_id uuid NOT NULL REFERENCES public.internal_declarations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('sent', 'error', 'reused')),
  sanitized_error text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX internal_declaration_sync_attempts_decl_idx
  ON public.internal_declaration_sync_attempts(declaration_id, attempted_at DESC);

GRANT SELECT ON public.internal_declaration_sync_attempts TO authenticated;
GRANT ALL ON public.internal_declaration_sync_attempts TO service_role;
ALTER TABLE public.internal_declaration_sync_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin en penningmeester lezen syncpogingen"
  ON public.internal_declaration_sync_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_treasurer(auth.uid()));

-- Foutdetail niet langer leesbaar op de declaratie zelf.
UPDATE public.internal_declarations SET informer_error = NULL WHERE informer_error IS NOT NULL;
COMMENT ON COLUMN public.internal_declarations.informer_error IS 'DEPRECATED: altijd NULL; foutdetails staan in internal_declaration_sync_attempts';

CREATE OR REPLACE FUNCTION public.protect_internal_declaration_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.informer_error := NULL;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('concept', 'pending') THEN
      RAISE EXCEPTION 'Ongeldige declaratiestatus';
    END IF;
    NEW.informer_status := 'not_sent';
    NEW.informer_external_id := NULL;
    NEW.informer_synced_at := NULL;
    NEW.informer_payment_status := NULL;
    NEW.informer_last_attempt_at := NULL;
    NEW.paid_at := NULL;
    NEW.bank_transaction_id := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.submitted_at := CASE WHEN NEW.status = 'pending' THEN now() ELSE NULL END;
  ELSE
    IF NOT (NEW.status = OLD.status OR (OLD.status = 'concept' AND NEW.status = 'pending')) THEN
      RAISE EXCEPTION 'Ongeldige statuswijziging';
    END IF;
    NEW.informer_status := OLD.informer_status;
    NEW.informer_external_id := OLD.informer_external_id;
    NEW.informer_synced_at := OLD.informer_synced_at;
    NEW.informer_payment_status := OLD.informer_payment_status;
    NEW.informer_last_attempt_at := OLD.informer_last_attempt_at;
    NEW.paid_at := OLD.paid_at;
    NEW.bank_transaction_id := OLD.bank_transaction_id;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.submitted_by := OLD.submitted_by;
    NEW.submitted_at := CASE WHEN OLD.status = 'concept' AND NEW.status = 'pending' THEN now() ELSE OLD.submitted_at END;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.protect_internal_declaration_fields() FROM PUBLIC, anon, authenticated;