-- Herkomst van een boekingstoewijzing: alleen 'automatisch' bij bekende interne notitie, zonder maker, én aantoonbare herkomst.
CREATE OR REPLACE FUNCTION public.ledger_override_is_automatic(_o public.ledger_entry_overrides)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _o.created_by IS NULL AND (
    (_o.note = 'Admin-herstel 2026-10-08: rekening→post' AND EXISTS (
      SELECT 1 FROM public.finance_repair_snapshots s
      WHERE s.table_name = 'ledger_entry_overrides' AND s.batch LIKE 'admin-herstel-2026-10-08%'
        AND s.row_key IN (_o.doc_type || ':' || _o.informer_id, _o.id::text)))
    OR _o.note = 'Post overgenomen van declaratie'
  )
$$;
REVOKE ALL ON FUNCTION public.ledger_override_is_automatic(public.ledger_entry_overrides) FROM PUBLIC, anon;

-- Atomische admin-toewijzing van post/dossier aan een declaratie (+ gekoppelde Informer-boeking).
CREATE OR REPLACE FUNCTION public.admin_allocate_declaration(_declaration_id uuid, _line_item_id uuid, _dossier text, _expected_updated_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  d public.internal_declarations; o public.ledger_entry_overrides;
  v_dossier text := nullif(btrim(coalesce(_dossier, '')), '');
  v_batch text := 'admin-indelen-' || to_char(now(), 'YYYY-MM-DD');
  v_key text; cur_post text; v_override text := 'none'; v_decl_changed boolean;
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
    v_key := 'purchase_invoice:' || d.informer_external_id;
    SELECT * INTO o FROM public.ledger_entry_overrides WHERE doc_type = 'purchase_invoice' AND informer_id = d.informer_external_id FOR UPDATE;
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
        VALUES ('purchase_invoice', d.informer_external_id, _line_item_id, v_dossier, auth.uid());
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
END $$;
REVOKE ALL ON FUNCTION public.admin_allocate_declaration(uuid, uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_allocate_declaration(uuid, uuid, text, timestamptz) TO authenticated;