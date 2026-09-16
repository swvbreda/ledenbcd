create or replace function public.get_member_register_logos()
returns table(member_id integer, location_key text, logo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select l.member_id, l.location_key, r.logo_url
  from public.coffeeshop_member_links l
  join public.coffeeshop_register r on r.id = l.register_id
  where l.status = 'bevestigd'
    and r.logo_url is not null
    and r.vervallen = false
$$;

revoke execute on function public.get_member_register_logos() from public, anon;
grant execute on function public.get_member_register_logos() to authenticated, service_role;