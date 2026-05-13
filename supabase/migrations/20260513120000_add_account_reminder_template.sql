INSERT INTO public.email_templates (key, subject, body) VALUES (
  'account_reminder',
  'Maak je account aan voor het ledenportaal',
  E'Beste {{contactpersoon}},\n\nWelkom bij de Bond van Cannabis Detaillisten. We zijn blij dat {{coffeeshop}} zich heeft aangesloten.\n\nVanaf nu kun je inloggen op het ledenportaal. Hier kun je de eigen gegevens wijzigen, de contactgegevens van het bestuur vinden en de ledenvoordelen bekijken.\n\nOok vind je in het ledenportaal de link naar de WhatsApp-community. Voel je vrij om je aan te sluiten bij de verschillende (werk)groepen.\n\nHeb je vragen? Neem dan gerust contact op.\n\nMet vriendelijke groet namens bestuur,\n\nSimone van Breda\n\nVoorzitter'
)
ON CONFLICT (key) DO NOTHING;
