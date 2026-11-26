CREATE OR REPLACE FUNCTION public.next_member_number()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _next integer;
begin
  if auth.uid() is not null
     and not (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid())) then
    raise exception 'Niet toegestaan';
  end if;

  perform pg_advisory_xact_lock(hashtext('members_data_number'));

  -- Een nummer met eerdere historie (financiën, notities, bewerkingen, koppelingen)
  -- wordt nooit hergebruikt: die historie zou anders aan een ander lid hangen.
  select min(g) into _next
  from generate_series(1, coalesce((select max(id) from members_data where id < 10000), 0) + 1) g
  where not exists (select 1 from members_data m where m.id = g)
    and not exists (select 1 from member_contributions x where x.member_id = g)
    and not exists (select 1 from contribution_invoices x where x.member_id = g)
    and not exists (select 1 from contribution_payments x where x.member_id = g)
    and not exists (select 1 from contribution_exemptions x where x.member_id = g)
    and not exists (select 1 from finance_todos x where x.member_id = g)
    and not exists (select 1 from member_notes x where x.member_id = g)
    and not exists (select 1 from member_edits x where x.member_id = g)
    and not exists (select 1 from member_profiles x where x.member_id = g)
    and not exists (select 1 from coffeeshop_member_links x where x.member_id = g)
    and not exists (select 1 from informer_debtor_map x where x.member_id = g)
    and not exists (select 1 from lead_conversions x where x.lidnummer = g or x.lead_id = g);

  if _next is null then
    select greatest(coalesce((select max(id) from members_data where id < 10000), 0),
                    coalesce((select max(lidnummer) from lead_conversions where lidnummer < 10000), 0)) + 1 into _next;
  end if;
  return _next;
end;
$function$;