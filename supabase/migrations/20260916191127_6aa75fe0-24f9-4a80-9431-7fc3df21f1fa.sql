create or replace function public.archive_member_with_renumber(_member_id integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _new_id integer;
  _data jsonb;
  _t text;
  _c text;
  _pairs text[][] := array[
    ['agenda_registrations','member_id'],
    ['beleidsmonitor_dossiers','member_id'],
    ['coffeeshop_member_links','member_id'],
    ['community_self_links','member_id'],
    ['contribution_invoices','member_id'],
    ['contribution_payments','member_id'],
    ['finance_todos','member_id'],
    ['informer_debtor_map','member_id'],
    ['informer_field_diffs','member_id'],
    ['member_allowed_emails','member_id'],
    ['member_contributions','member_id'],
    ['member_data_consents','member_id'],
    ['member_edit_requests','member_id'],
    ['member_edits','member_id'],
    ['member_location_register_status','member_id'],
    ['member_mailing_preferences','member_id'],
    ['member_notes','member_id'],
    ['member_profiles','member_id'],
    ['member_whatsapp_status','member_id'],
    ['register_enrichment_proposals','member_id'],
    ['whatsapp_conversations','member_id'],
    ['whatsapp_messages','member_id'],
    ['whatsapp_participants','member_id'],
    ['whatsapp_preferences','member_id'],
    ['board_members','lid_id'],
    ['coffeeshop_register','lid_opgave_member_id']
  ];
begin
  -- Beheer/bestuur vanuit de app, of een achtergrondtaak zonder sessie.
  if auth.uid() is not null
     and not (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid())) then
    raise exception 'Niet toegestaan';
  end if;

  if _member_id >= 10000 then
    return _member_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('members_data_number'));

  select data into _data from members_data where id = _member_id;
  if _data is null then
    raise exception 'Lid % bestaat niet', _member_id;
  end if;

  select coalesce(max(id), 10000) + 1 into _new_id from members_data where id >= 10000;

  insert into members_data (id, member_type, data)
  values (_new_id, 'old', jsonb_set(_data, '{id}', to_jsonb(_new_id)));

  for _t, _c in
    select p[1], p[2] from (select _pairs[i:i][1:2] as p from generate_subscripts(_pairs, 1) i) s
  loop
    execute format('update public.%I set %I = $1 where %I = $2', _t, _c, _c)
      using _new_id, _member_id;
  end loop;

  update public.board_members
  set lid_ids = array_replace(lid_ids, _member_id, _new_id)
  where lid_ids @> array[_member_id];

  delete from members_data where id = _member_id;

  return _new_id;
end;
$$;

create or replace function public.next_member_number()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _next integer;
begin
  if auth.uid() is not null
     and not (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid())) then
    raise exception 'Niet toegestaan';
  end if;

  perform pg_advisory_xact_lock(hashtext('members_data_number'));

  select min(g) into _next
  from generate_series(1, coalesce((select max(id) from members_data where id < 10000), 0) + 1) g
  left join members_data m on m.id = g
  where m.id is null;

  return coalesce(_next, 1);
end;
$$;