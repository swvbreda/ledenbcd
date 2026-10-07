-- Declaraties: concept/indienen, meerdere bonnen, metadata en Informer-workflowstatus.
ALTER TABLE public.internal_declarations
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS budget_reference text,
  ADD COLUMN IF NOT EXISTS receipt_paths text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS informer_payment_status text,
  ADD COLUMN IF NOT EXISTS informer_last_attempt_at timestamptz;

ALTER TABLE public.internal_declarations DROP CONSTRAINT IF EXISTS internal_declarations_informer_status_check;
ALTER TABLE public.internal_declarations ADD CONSTRAINT internal_declarations_informer_status_check
  CHECK (informer_status IN ('not_sent', 'queued', 'sending', 'synced', 'error'));
ALTER TABLE public.internal_declarations DROP CONSTRAINT IF EXISTS internal_declarations_payment_status_check;
ALTER TABLE public.internal_declarations ADD CONSTRAINT internal_declarations_payment_status_check
  CHECK (informer_payment_status IS NULL OR informer_payment_status IN ('open', 'paid'));

-- Bestaande records veilig aanvullen; geen Informer-documenten aanmaken.
UPDATE public.internal_declarations
  SET receipt_paths = ARRAY[receipt_path]
  WHERE receipt_path IS NOT NULL AND cardinality(receipt_paths) = 0;
UPDATE public.internal_declarations
  SET submitted_at = created_at
  WHERE submitted_at IS NULL AND status <> 'concept';

-- Indieners mogen geen Informer-, betaal- of beoordelingsvelden zetten.
CREATE OR REPLACE FUNCTION public.protect_internal_declaration_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('concept', 'pending') THEN
      RAISE EXCEPTION 'Ongeldige declaratiestatus';
    END IF;
    NEW.informer_status := 'not_sent';
    NEW.informer_external_id := NULL;
    NEW.informer_error := NULL;
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
    NEW.informer_error := OLD.informer_error;
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

DROP TRIGGER IF EXISTS protect_internal_declaration_fields ON public.internal_declarations;
CREATE TRIGGER protect_internal_declaration_fields
  BEFORE INSERT OR UPDATE ON public.internal_declarations
  FOR EACH ROW EXECUTE FUNCTION public.protect_internal_declaration_fields();

-- Indieners mogen concepten en nog niet verzonden aanvragen beheren.
DROP POLICY IF EXISTS "Submitters can update own pending declarations" ON public.internal_declarations;
CREATE POLICY "Submitters can update own pending declarations" ON public.internal_declarations
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() AND status IN ('concept', 'pending') AND informer_status IN ('not_sent', 'error'))
  WITH CHECK (submitted_by = auth.uid() AND status IN ('concept', 'pending'));
DROP POLICY IF EXISTS "Submitters can delete own pending declarations" ON public.internal_declarations;
CREATE POLICY "Submitters can delete own pending declarations" ON public.internal_declarations
  FOR DELETE TO authenticated
  USING (submitted_by = auth.uid() AND status IN ('concept', 'pending') AND informer_status = 'not_sent');