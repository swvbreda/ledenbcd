INSERT INTO public.email_templates (key, subject, body) VALUES (
  'account_reminder',
  'Maak je account aan voor het ledenportaal',
  E'Beste {{contactpersoon}} van {{coffeeshop}},\n\nJe bent lid van de Bond van Cannabis Detaillisten, maar we zien dat je nog geen account hebt aangemaakt op het ledenportaal. Jammer! Want daar vind je veel handige informatie.\n\nEen account aanmaken doe je zo:\n\n1. Ga naar https://leden.coffeeshopbond.nl\n2. Klik op "Account aanmaken"\n3. Vul je e-mailadres in dat bij ons bekend is\n4. Kies een wachtwoord en bevestig je e-mailadres\n\nIn het ledenportaal kun je je eigen gegevens wijzigen, de contactgegevens van het bestuur vinden en de ledenvoordelen bekijken. Ook vind je er de link naar de WhatsApp-community.\n\nHeb je vragen of lukt het aanmaken niet? Neem dan gerust contact op.\n\nMet vriendelijke groet namens bestuur,\n\nSimone van Breda\nVoorzitter'
)
ON CONFLICT (key) DO NOTHING;