begin;
create table public.member_reconfirmation_requests (
 id uuid primary key default gen_random_uuid(),
 campaign text not null,
 member_id integer not null references public.members_data(id),
 invoice_number text not null,
 created_by uuid not null references auth.users(id),
 token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
 sent_at timestamptz,
 activated_at timestamptz,
 deadline timestamptz not null,
 confirmed_at timestamptz,
 revoked_at timestamptz,
 created_at timestamptz not null default now(),
 unique(campaign,member_id)
);
alter table public.member_reconfirmation_requests enable row level security;
revoke all on public.member_reconfirmation_requests from public,anon,authenticated;
grant all on public.member_reconfirmation_requests to service_role;

create function public.member_reconfirmation_answer(_hash text,_confirm boolean default false)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare r public.member_reconfirmation_requests;
begin
 if _hash is null or _hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('valid',false); end if;
 select * into r from public.member_reconfirmation_requests where token_hash=_hash for update;
 if not found or r.revoked_at is not null or r.activated_at is null then return jsonb_build_object('valid',false); end if;
 if r.confirmed_at is not null then return jsonb_build_object('valid',true,'confirmed',true,'deadline',r.deadline); end if;
 if r.deadline<now() then return jsonb_build_object('valid',false); end if;
 if _confirm then
   update public.member_reconfirmation_requests set confirmed_at=now() where id=r.id;
   insert into public.member_notes(member_id,note,created_by) values(r.member_id,'Lidmaatschapsbevestiging ontvangen via de persoonlijke link van het secretariaat. Het lid wil aangesloten blijven en ledencommunicatie ontvangen. Bevestigd op '||to_char(now() at time zone 'Europe/Amsterdam','DD-MM-YYYY HH24:MI')||'. Dit is geen betaalbevestiging.',r.created_by);
 end if;
 return jsonb_build_object('valid',true,'confirmed',_confirm,'deadline',r.deadline);
end $$;
revoke all on function public.member_reconfirmation_answer(text,boolean) from public,anon,authenticated;
grant execute on function public.member_reconfirmation_answer(text,boolean) to service_role;
commit;
