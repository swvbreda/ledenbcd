ALTER TABLE public.internal_declarations
  ADD COLUMN IF NOT EXISTS budget_line_item_id uuid NULL REFERENCES public.budget_line_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dossier text NULL;
COMMENT ON COLUMN public.internal_declarations.budget_line_item_id IS 'Begrotingspost, alleen door admin/administratie toegewezen.';
COMMENT ON COLUMN public.internal_declarations.dossier IS 'Dossier (zelfde vrije-tekstconventie als budget/ledger), alleen door admin/administratie toegewezen.';
CREATE INDEX IF NOT EXISTS internal_declarations_budget_line_item_idx ON public.internal_declarations(budget_line_item_id);

CREATE OR REPLACE FUNCTION public.protect_internal_declaration_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    NEW.budget_line_item_id := NULL;
    NEW.dossier := NULL;
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
    NEW.budget_line_item_id := OLD.budget_line_item_id;
    NEW.dossier := OLD.dossier;
    NEW.submitted_at := CASE WHEN OLD.status = 'concept' AND NEW.status = 'pending' THEN now() ELSE OLD.submitted_at END;
  END IF;
  RETURN NEW;
END $function$;