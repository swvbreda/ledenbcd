UPDATE public.email_templates
SET subject = 'Welkom bij de Bond van Cannabis Detaillisten',
    body = E'Beste {{contactpersoon}} van {{coffeeshop}},\n\nWelkom bij de Bond van Cannabis Detaillisten. We hete jullie van harte welkom!\n\nVanaf nu kun je inloggen op het ledenportaal. Hier kun je de eigen gegevens wijzigen, de contactgegevens van het bestuur vinden en de ledenvoordelen bekijken.\n\nOok vind je in het ledenportaal de link naar de WhatsApp-community. Voel je vrij om je aan te sluiten bij de verschillende (werk)groepen.\n\nHeb je vragen? Neem dan gerust contact op.\n\nMet vriendelijke groet namens bestuur,\n\nSimone van Breda\nVoorzitter',
    updated_at = now()
WHERE key = 'account_reminder';