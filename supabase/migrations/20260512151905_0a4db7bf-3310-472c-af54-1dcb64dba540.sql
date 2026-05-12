create table if not exists public.email_templates (
  key text primary key,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

alter table public.email_templates enable row level security;

create policy "Admins can manage email templates"
on public.email_templates for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

insert into public.email_templates (key, subject, body) values
('member_welcome',
 'Welkom bij de Bond van Cannabis Detaillisten',
 E'Beste {{contactpersoon}},\n\nWelkom bij de Bond van Cannabis Detaillisten! We zijn blij dat {{coffeeshop}} zich heeft aangesloten.\n\nJe kunt vanaf nu inloggen op het ledenportaal en gebruikmaken van alle voordelen en informatie die wij voor onze leden beschikbaar stellen.\n\nHeb je vragen? Neem gerust contact op met het secretariaat.\n\nMet vriendelijke groet,\nBestuur BCD'),
('lead_welcome',
 'Uitnodiging: ontdek de Bond van Cannabis Detaillisten',
 E'Beste {{contactpersoon}},\n\nLeuk dat we kennis hebben gemaakt met {{coffeeshop}}. Graag nodigen we je uit om kennis te maken met de Bond van Cannabis Detaillisten en de voordelen die wij onze leden bieden.\n\nHeb je vragen of wil je meer informatie? Neem gerust contact op met het secretariaat.\n\nMet vriendelijke groet,\nBestuur BCD')
on conflict (key) do nothing;