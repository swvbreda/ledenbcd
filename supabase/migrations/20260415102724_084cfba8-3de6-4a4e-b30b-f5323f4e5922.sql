
CREATE OR REPLACE FUNCTION public.auto_cleanup_archived_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_naam text;
  current_yr integer;
BEGIN
  -- Only fire when member_type changes to 'old'
  IF OLD.member_type = 'member' AND NEW.member_type = 'old' THEN
    member_naam := COALESCE(NEW.data->>'naam', NEW.data->>'bedrijfsnaam', 'Lid #' || NEW.id);
    current_yr := (EXTRACT(year FROM now()))::integer;

    -- Delete all pending finance todos for this member
    DELETE FROM public.finance_todos
    WHERE member_id = NEW.id AND status = 'pending';

    -- Delete unpaid contributions without an invoice sent
    DELETE FROM public.member_contributions
    WHERE member_id = NEW.id AND paid = false AND invoice_number IS NULL AND invoice_date IS NULL;

    -- Create a cleanup checklist todo
    INSERT INTO public.finance_todos (todo_type, title, description, assigned_to, member_id, year)
    VALUES (
      'member_archived',
      'Opzegging verwerken: ' || member_naam,
      'Lid ' || member_naam || ' (#' || NEW.id || ') is gearchiveerd. Controleer:' || chr(10) ||
      '- Facturatie stopgezet (eventuele openstaande facturen afhandelen)' || chr(10) ||
      '- Toegang ingetrokken (account, ledenportaal)' || chr(10) ||
      '- Lopende zaken afgerond (declaraties, toestemmingen)',
      'secretariaat',
      NEW.id,
      current_yr
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_cleanup_archived_member
  AFTER UPDATE ON public.members_data
  FOR EACH ROW
  WHEN (OLD.member_type = 'member' AND NEW.member_type = 'old')
  EXECUTE FUNCTION public.auto_cleanup_archived_member();
