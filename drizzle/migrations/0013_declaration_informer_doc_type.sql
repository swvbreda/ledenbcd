ALTER TABLE public.internal_declarations ADD COLUMN IF NOT EXISTS informer_doc_type text;
ALTER TABLE public.internal_declarations ADD CONSTRAINT internal_declarations_informer_doc_type_check
  CHECK (informer_doc_type IS NULL OR informer_doc_type IN ('purchase_invoice','receipt'));
COMMENT ON COLUMN public.internal_declarations.informer_doc_type IS 'Server-owned: Informer namespace of informer_external_id (purchase_invoice or receipt). Never infer from the id alone.';

-- Backfill alleen met bewijs: document staat als inkoopfactuur in de Informer-import.
INSERT INTO public.finance_repair_snapshots (batch, table_name, row_key, before_row, action)
SELECT 'doc-type-backfill-2026-10-08', 'internal_declarations', d.id::text, to_jsonb(d), 'set informer_doc_type purchase_invoice'
FROM public.internal_declarations d
WHERE d.informer_external_id IS NOT NULL AND d.informer_doc_type IS NULL
  AND EXISTS (SELECT 1 FROM public.informer_ledger_entries e WHERE e.doc_type='purchase_invoice' AND e.informer_id=d.informer_external_id);
UPDATE public.internal_declarations d SET informer_doc_type='purchase_invoice'
WHERE d.informer_external_id IS NOT NULL AND d.informer_doc_type IS NULL
  AND EXISTS (SELECT 1 FROM public.informer_ledger_entries e WHERE e.doc_type='purchase_invoice' AND e.informer_id=d.informer_external_id);

CREATE OR REPLACE FUNCTION public.protect_internal_declaration_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  NEW.informer_error := NULL;
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND NEW.status IS DISTINCT FROM OLD.status
     AND (NEW.status IN ('approved','rejected') OR OLD.status IN ('approved','rejected')) THEN
    IF NOT public.is_declaration_approver(auth.uid()) THEN
      RAISE EXCEPTION 'Alleen Bernard of Simone mag declaraties goedkeuren of afwijzen';
    END IF;
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('approved','rejected') THEN
      RAISE EXCEPTION 'Alleen ingediende declaraties kunnen worden goedgekeurd of afgewezen';
    END IF;
  END IF;
  -- Documentsoort is alleen door de server (Informer-koppeling) te zetten.
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN NEW.informer_doc_type := NULL;
    ELSE NEW.informer_doc_type := OLD.informer_doc_type; END IF;
  END IF;
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
    IF EXISTS (SELECT 1 FROM public.declaration_payment_confirmations c WHERE c.declaration_id = OLD.id) THEN
      RAISE EXCEPTION 'Declaratie is als betaald bevestigd en kan niet meer worden gewijzigd';
    END IF;
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

CREATE OR REPLACE FUNCTION public.declaration_mirror_post_to_ledger()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.informer_external_id IS NOT NULL AND OLD.informer_external_id IS NULL AND NEW.budget_line_item_id IS NOT NULL
     AND NEW.informer_doc_type IN ('purchase_invoice','receipt') THEN
    INSERT INTO public.ledger_entry_overrides (doc_type, informer_id, line_item_id, dossier, note)
    VALUES (NEW.informer_doc_type, NEW.informer_external_id, NEW.budget_line_item_id, NEW.dossier, 'Post overgenomen van declaratie')
    ON CONFLICT (doc_type, informer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_allocate_declaration(_declaration_id uuid, _line_item_id uuid, _dossier text, _expected_updated_at timestamp with time zone)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  d public.internal_declarations; o public.ledger_entry_overrides;
  v_dossier text := nullif(btrim(coalesce(_dossier, '')), '');
  v_batch text := 'admin-indelen-' || to_char(now(), 'YYYY-MM-DD');
  v_key text; cur_post text; v_override text := 'none'; v_decl_changed boolean; v_type text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Alleen de administratie kan posten en dossiers toewijzen.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.internal_declarations WHERE id = _declaration_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Declaratie niet gevonden.'; END IF;
  IF _expected_updated_at IS NOT NULL AND d.updated_at IS DISTINCT FROM _expected_updated_at THEN
    RAISE EXCEPTION 'Declaratie is intussen gewijzigd; vernieuw en probeer opnieuw.' USING ERRCODE = '40001';
  END IF;
  IF _line_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.budget_line_items li JOIN public.budget_categories c ON c.id = li.category_id
    WHERE li.id = _line_item_id AND c.year = d.year) THEN
    RAISE EXCEPTION 'Deze begrotingspost hoort niet bij het jaar van de declaratie.';
  END IF;

  IF d.informer_external_id IS NOT NULL THEN
    v_type := d.informer_doc_type;
    IF v_type IS NULL THEN
      RAISE EXCEPTION 'Soort Informer-document van % is onbekend; eerst controleren.', d.informer_external_id;
    END IF;
    v_key := v_type || ':' || d.informer_external_id;
    SELECT * INTO o FROM public.ledger_entry_overrides WHERE doc_type = v_type AND informer_id = d.informer_external_id FOR UPDATE;
    IF FOUND THEN
      o.dossier := nullif(btrim(coalesce(o.dossier, '')), '');
      SELECT li.name || ' (' || c.year || ')' INTO cur_post FROM public.budget_line_items li JOIN public.budget_categories c ON c.id = li.category_id WHERE li.id = o.line_item_id;
      IF o.excluded THEN
        RAISE EXCEPTION 'Informer-document % is in de boekhouding uitgesloten; pas dat daar aan.', d.informer_external_id;
      END IF;
      IF NOT (o.line_item_id IS NOT DISTINCT FROM _line_item_id AND o.dossier IS NOT DISTINCT FROM v_dossier) THEN
        IF EXISTS (SELECT 1 FROM public.expense_dossier_splits s WHERE s.entry_key IN (v_key, 'ledger:' || v_key, 'expense:ledger:' || v_key)) THEN
          RAISE EXCEPTION 'Informer-document % heeft dossiersplitsingen; pas die aan bij de boekhouding (Uitgaven).', d.informer_external_id;
        END IF;
        IF NOT public.ledger_override_is_automatic(o)
           AND ((o.line_item_id IS NOT NULL AND o.line_item_id IS DISTINCT FROM _line_item_id)
             OR (o.dossier IS NOT NULL AND o.dossier IS DISTINCT FROM v_dossier)) THEN
          RAISE EXCEPTION 'Informer-document % heeft een handmatige toewijzing: post %, dossier %. Pas die aan bij de boekhouding (Uitgaven).',
            d.informer_external_id, coalesce(cur_post, 'geen'), coalesce(o.dossier, 'geen');
        END IF;
        INSERT INTO public.finance_repair_snapshots (batch, table_name, row_key, before_row, action)
          SELECT v_batch, 'ledger_entry_overrides', o.id::text, to_jsonb(x), 'admin allocate' FROM public.ledger_entry_overrides x WHERE x.id = o.id;
        UPDATE public.ledger_entry_overrides SET line_item_id = _line_item_id, dossier = v_dossier, created_by = auth.uid(), updated_at = now() WHERE id = o.id;
        v_override := 'updated';
      ELSE
        v_override := 'unchanged';
      END IF;
    ELSIF _line_item_id IS NOT NULL OR v_dossier IS NOT NULL THEN
      INSERT INTO public.ledger_entry_overrides (doc_type, informer_id, line_item_id, dossier, created_by)
        VALUES (v_type, d.informer_external_id, _line_item_id, v_dossier, auth.uid());
      v_override := 'created';
    END IF;
  END IF;

  v_decl_changed := d.budget_line_item_id IS DISTINCT FROM _line_item_id OR d.dossier IS DISTINCT FROM v_dossier;
  IF v_decl_changed THEN
    INSERT INTO public.finance_repair_snapshots (batch, table_name, row_key, before_row, action)
      VALUES (v_batch, 'internal_declarations', d.id::text, to_jsonb(d), 'admin allocate');
    UPDATE public.internal_declarations SET budget_line_item_id = _line_item_id, dossier = v_dossier WHERE id = d.id;
  END IF;
  RETURN jsonb_build_object('declaration', CASE WHEN v_decl_changed THEN 'updated' ELSE 'unchanged' END, 'override', v_override);
END $function$;