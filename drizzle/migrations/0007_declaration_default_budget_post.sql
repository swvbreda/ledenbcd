-- Standaardpost per declaratiesoort en jaar: reiskosten/overig -> 'Reiskosten', vrijwilligers -> 'Onkosten vergoedingen'.
-- Alleen bij exact één post met die naam in dat jaar; anders NULL (review, nooit eerste post).
CREATE OR REPLACE FUNCTION public.declaration_default_line_item(_type text, _year integer, _expense_date date)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH target AS (
    SELECT CASE
      WHEN _type IN ('reiskosten', 'overig') THEN 'Reiskosten'
      WHEN _type IN ('penningmeester', 'woordvoering') THEN 'Onkosten vergoedingen'
    END AS name
  ), hits AS (
    SELECT li.id FROM public.budget_line_items li
    JOIN public.budget_categories c ON c.id = li.category_id, target t
    WHERE t.name IS NOT NULL AND li.name = t.name AND c.year = _year
      AND _expense_date IS NOT NULL AND extract(year FROM _expense_date)::int = _year
  )
  SELECT CASE WHEN (SELECT count(*) FROM hits) = 1 THEN (SELECT id FROM hits) END
$$;
REVOKE ALL ON FUNCTION public.declaration_default_line_item(text, integer, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.declaration_default_line_item(text, integer, date) TO authenticated, service_role;

-- Loopt ná protect_internal_declaration_fields (alfabetisch): vult alleen een lege post; handmatige keuze blijft.
CREATE OR REPLACE FUNCTION public.zz_declaration_default_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.budget_line_item_id IS NULL THEN
    NEW.budget_line_item_id := public.declaration_default_line_item(NEW.declaration_type, NEW.year, NEW.expense_date);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_declaration_default_post BEFORE INSERT OR UPDATE ON public.internal_declarations
  FOR EACH ROW EXECUTE FUNCTION public.zz_declaration_default_post();

-- Bij eerste koppeling aan een Informer-document: post spiegelen naar de boekingstoewijzing, nooit overschrijven.
CREATE OR REPLACE FUNCTION public.declaration_mirror_post_to_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.informer_external_id IS NOT NULL AND OLD.informer_external_id IS NULL AND NEW.budget_line_item_id IS NOT NULL THEN
    INSERT INTO public.ledger_entry_overrides (doc_type, informer_id, line_item_id, dossier, note)
    VALUES ('purchase_invoice', NEW.informer_external_id, NEW.budget_line_item_id, NEW.dossier, 'Post overgenomen van declaratie')
    ON CONFLICT (doc_type, informer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER declaration_mirror_post_to_ledger AFTER UPDATE OF informer_external_id ON public.internal_declarations
  FOR EACH ROW EXECUTE FUNCTION public.declaration_mirror_post_to_ledger();