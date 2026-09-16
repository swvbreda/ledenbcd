create table public.member_affiliations (
  id uuid primary key default gen_random_uuid(),
  member_id integer not null,
  related_member_id integer not null,
  notitie text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint member_affiliations_verschillend check (member_id <> related_member_id),
  constraint member_affiliations_uniek unique (member_id, related_member_id)
);

grant select, insert, update, delete on public.member_affiliations to authenticated;
grant all on public.member_affiliations to service_role;

alter table public.member_affiliations enable row level security;

create policy "Leden zien gelieerde leden"
  on public.member_affiliations for select to authenticated using (true);

create policy "Bestuur beheert gelieerde leden"
  on public.member_affiliations for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid()))
  with check (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid()));

create table public.location_duplicate_dismissals (
  id uuid primary key default gen_random_uuid(),
  groep_sleutel text not null unique,
  reden text,
  door uuid,
  op timestamptz not null default now()
);

grant select, insert, delete on public.location_duplicate_dismissals to authenticated;
grant all on public.location_duplicate_dismissals to service_role;

alter table public.location_duplicate_dismissals enable row level security;

create policy "Bestuur beheert beoordeelde dubbelingen"
  on public.location_duplicate_dismissals for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid()))
  with check (public.has_role(auth.uid(), 'admin') or public.is_board_member(auth.uid()));

insert into public.member_affiliations (member_id, related_member_id, notitie)
values (51, 66, 'Zelfde pand 1e Oosterparkstraat 47'),
       (66, 51, 'Zelfde pand 1e Oosterparkstraat 47')
on conflict do nothing;