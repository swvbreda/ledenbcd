# Aanmelden voor een evenement laten werken

## Wat er nu misgaat

Job's account (jobarnold@ziggo.nl) is wél ingelogd geweest vandaag, maar zijn account is in de database niet gekoppeld aan zijn lidnummer (137 — Coffeeshop Takeaway De Kruidenier). Zijn e-mailadres staat wel in de lijst met toegestane adressen voor dat lid, dus de automatische koppeling had moeten plaatsvinden maar is niet gelukt. Waarom die automatische koppeling faalde is nog niet vastgesteld.

Gevolg: op de evenementkaart verschijnt voor hem helemaal géén "Aanmelden"-knop. Er staat ook geen uitleg, dus het lijkt alsof de link "gewoon naar de Agenda" gaat en aanmelden niet lukt.

## Wat we gaan doen

1. **Job direct koppelen** aan lid 137, zodat hij zich vandaag nog kan aanmelden voor de Experiment bijeenkomst.
2. **Oorzaak vaststellen** van de mislukte automatische koppeling (rechten/beveiligingsregels op de koppeltabel), en die herstellen zodat het bij iedereen werkt.
3. **Nooit meer een lege kaart:** is iemand ingelogd zonder koppeling, dan komt er op de evenementkaart een duidelijke knop/melding in plaats van niets — met een poging tot automatisch koppelen en anders de tekst "Je account is nog niet aan een lid gekoppeld — neem contact op met het secretariaat".
4. **Controle op alle accounts:** we kijken welke andere ingelogde accounts een toegestaan e-mailadres hebben maar geen koppeling, en herstellen die in één keer.
5. **Napraten met Job:** na de fix testen we zijn link opnieuw zodat de knop bij hem echt tot een aanmelding leidt.

## Technisch

- Verifiëren waarom `ensure_member_link()` geen rij in `member_profiles` schrijft voor deze gebruiker (RLS/grants op `member_profiles`, of foutafhandeling die stil faalt); daarna gerichte migratie om koppelingen te herstellen op basis van `member_allowed_emails`.
- `AgendaEventCard.tsx`: fallback-tak toevoegen voor `memberId == null && !isAdmin` met knop "Koppeling herstellen" (roept de reparatie-RPC aan en ververst) en verklarende tekst.
- Eenmalige backfill-query voor bestaande accounts met ontbrekende koppeling.
- Geen wijziging aan de deel-link `/a/CODE`; die werkt en stuurt na inloggen naar het juiste agendapunt.
