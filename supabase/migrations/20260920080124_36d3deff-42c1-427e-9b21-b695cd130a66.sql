
create or replace function public.get_my_contribution_invoices(_year integer default null)
returns table(
  member_id integer,
  invoice_number text,
  entry_date date,
  due_date date,
  year integer,
  amount_incl numeric,
  paid_amount numeric,
  open_amount numeric,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    d.member_id,
    e.invoice_number,
    e.entry_date,
    e.due_date,
    e.year,
    e.amount_incl,
    e.paid_amount,
    e.open_amount,
    e.status
  from public.informer_ledger_entries e
  join public.informer_debtor_map d
    on d.informer_debtor_id = e.relation_id
  join public.member_profiles p
    on p.member_id = d.member_id
  where p.user_id = auth.uid()
    and e.doc_type = 'sales_invoice'
    and e.deleted_at is null
    and e.status in ('open', 'paid')
    and e.ledger_account ilike '%contribut%'
    and (_year is null or e.year = _year)
$$;

revoke all on function public.get_my_contribution_invoices(integer) from public, anon;
grant execute on function public.get_my_contribution_invoices(integer) to authenticated;
