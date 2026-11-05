# Opstartpad — review 5 november 2026

## Scope en resultaat

Geen publicatie, native build, berichten, database-/rechtenwijzigingen of fictieve sessies. Twee beperkte optimalisaties zijn in preview aangebracht. Aantoonbaar minder onnodige code en één seriële gegevensafhankelijkheid verwijderd; **nog geen bewezen verbetering van totale opentijd**.

## Metingen

Playwright Chromium vanuit dezelfde sandbox, 1280×1800, drie verse browsercontexts per origin; elk eerst `/` koud, daarna opnieuw `/` in hetzelfde context. Signed-out start eindigt op `/login`. Koud betekent browsercache leeg, niet CDN/servercache leeg. Tijd tot de echte knop Inloggen beschikbaar is; geen gewijzigde loading-indicator als winst geteld. Assets verzameld 1,5 seconde daarna. Geen CPU-/netwerkthrottling. Live blijft onveranderd en dient als controle voor netwerkvariatie.

| Origin/toestand | Voor mediaan | Na mediaan |
|---|---:|---:|
| Preview koud: Inloggen beschikbaar | 2.100 ms | 2.251 ms |
| Preview warm: Inloggen beschikbaar | 1.239 ms | 1.271 ms |
| Preview koud: TTFB / document gereed / DOMContentLoaded | 24 / 27 / 204 ms | 32 / 34 / 233 ms |
| Preview warm: TTFB / document gereed / DOMContentLoaded | 20 / 22 / 161 ms | 26 / 28 / 218 ms |
| Ongewijzigde live site koud: Inloggen beschikbaar | 3.135 ms | 2.875 ms |
| Ongewijzigde live site warm: Inloggen beschikbaar | 1.231 ms | 1.647 ms |
| Ongewijzigde live site koud: TTFB / document gereed / DOMContentLoaded | 1.393 / 1.396 / 1.799 ms | 1.728 / 1.731 / 1.979 ms |
| Ongewijzigde live site warm: TTFB / document gereed / DOMContentLoaded | 1.039 / 1.042 / 1.086 ms | 1.454 / 1.457 / 1.505 ms |

De voor/na-runs bewijzen geen tijdwinst; ontwikkelbundels en netwerkvariatie beperken vergelijking. Een echte productie-na-meting kan pas na afzonderlijk goedgekeurde publicatie. Geen handmatige projectbuild uitgevoerd.

### Bestanden en verzoeken

- Live signed-out `/` laadt circa **1.466.256 bytes ongecomprimeerde JS** inclusief later geladen scripts; dat is het gemeten startvenster, niet één main bundle. Main `index-HPf0LhZz.js`: **486.293 bytes** (152.038 bytes transfer inclusief overhead). Dashboardchunk `_dashboard-LLwsW0ny.js`: **468.322 bytes** (121.458 bytes transfer). Browser moest deze dashboardafhankelijkheden dus ook bij uitloggen downloaden.
- Eerste live run: main-download 203 ms, dashboard 275 ms, clientbibliotheek 442 ms, stylesheet 341 ms; logobeeld begint pas rond 3.117 ms en duurt 199 ms. Dit betreft één load, geen p75 of gegarandeerde apparaatprestatie.
- In ontwikkelpreview werd vóór de wijziging `recharts.js` van **4.008.328 bytes** opgehaald bij signed-out openen; na de wijziging niet. Ook `DashboardLayout.tsx`, `KerngegevensPage.tsx` en `VerloopChart.tsx` zijn niet meer aanwezig in dit startvenster. Dit is een ontwikkelbestand, **geen** claim van 4 MB productiebesparing. Nieuwe productiebundlegrootte is niet beschikbaar in deze sandbox.
- Signed-out desktop en 390×844: geen private REST-reads, geen grafiek-/dashboardlayoutdownload; login zonder browsererrors. Screenshots en ruwe timingdata staan tijdelijk onder `/tmp/browser/startup/`.

### Echte bezoekers, afgelopen zeven dagen

Series geaggregeerd op metric-ID (maximale waarde), vervolgens p75. Minder dan 30 readings per metric: **te weinig data voor een betrouwbare paginarangschikking**.

| `/` metric | readings | p75 | goed | Google grens |
|---|---:|---:|---:|---:|
| FCP | 24 | 4.453 ms | 8,3% | 1.800 ms |
| LCP | 19 | 8.983 ms | 5,3% | 2.500 ms |
| INP | 13 | 232 ms | 69,2% | 200 ms |
| CLS | 6 | 0,312 | 50% | 0,1 |
| TTFB | 27 | 1.937 ms | 7,4% | — |

Dit is live vóór de wijzigingen, niet specifiek Simone of uitsluitend iPhones. `/login`: FCP p75 2.965 ms en LCP p75 10.808 ms, beide slechts 4 readings.

## Concrete diff

1. `src/routes/_dashboard.tsx`: dashboardlayout via React.lazy **binnen** bestaande ProtectedRoute, dus niet al bij signed-out auth-bootstrap. Bestaande auth- en rolcontrole ongewijzigd.
2. `src/pages/Index.tsx`: VerloopChart en KerngegevensDashboard via lazy + afzonderlijke Suspense, zodat Recharts niet de routebundel/overige dashboardonderdelen blokkeert. Onderdelen worden daadwerkelijk geladen wanneer het echte dashboard rendert, niet verborgen of verwijderd. Geen scroll-afhankelijke uitgestelde gegevens of demo.
3. `src/contexts/MembersDataContext.tsx`: eigen RLS-ledenrijen en toegestane geschoonde directory tegelijk ophalen met Promise.all. Resultaat pas als beide gereed zijn; eigen canonical rij blijft leidend, bronfout blijft fout. Cachekey blijft gebruiker-ID en toegangsomvang bevatten. Admin/board/extern/inhuur krijgen geen extra directoryaanroep.
4. `src/components/__tests__/MembersStartup.render.tsx`: vier tests voor gelijktijdig starten, atomair resultaat/canonical 150 vs 32, geen gedeeltelijk succes bij bronfout, geen reads vóór geverifieerde auth en geen directory voor admin.
5. Root AGENTS.md en roadmap bijgewerkt voor deze afbakening.

## Auth/dashboard en iPhone beperkingen

- `useAuth`: sessiebootstrap gebruikt bestaande getSession/auth-listener; accessController single-flight/generation guard blijft intact. Servergeverifieerde gebruiker/rollen en memberlink/bestuursread lopen al parallel; ensure_member_link → member_profiles is een echte afhankelijkheid en niet weggehaald. Geen rollen uit clientopslag toegevoegd, geen sessie fake gemaakt, geen private cache gedeeld.
- Dashboard wacht op members-data. Alleen gewone gekoppelde leden hadden hierin de bewezen **seriële** eigen-read → directory-read; nu concurrent. Dashboardwidgets doen eigen reads, maar hun werkelijke ingelogde timings zijn niet vastgesteld.
- Beschikbare sessie signed_out; `lovable auth-session --json --self` meldt geen eigen gekoppeld account. Geen andere account gemint. Daarom geen ingelogde auth-bootstrap-, query- of dashboard-tijden, en geen claim van ingelogde end-to-end verificatie.
- `capacitor.config.ts`: server.url exact `https://leden.coffeeshopbond.nl`, TLS, geen oude-hostredirect. Splash `launchShowDuration: 800`, auto-hide true, geen spinner. Native CI doet cap sync met deze config. Geen op toestel uitgelezen binaryconfig; dit bewijst de repositoryconfig, niet de instellingen van elke geïnstalleerde oude build.
- Een warm **WKWebView-resume** is niet hetzelfde als browserreload; toestelnetwerk, iOS-splash en hervatten kunnen niet vanuit Chromium worden gemeten. Bestaande native auth-resume laat geverifieerde rechten staan bij achtergrondrefresh; volledig reload na vier uur blijft onveranderd.
- Deze frontendwijzigingen vereisen alleen afzonderlijk goedgekeurde webpublicatie voor builds die de ingestelde remote URL laden. **Geen native rebuild nodig** voor deze diff. Splash/native configuratie niet gewijzigd.

## Checks / resterend

18 tests geslaagd: 4 nieuwe opstarttests, 11 canonical-dossierregressies, 3 pushreceipt-regressies. Optionele defecte canvas-installatie tijdelijk buiten node_modules gehouden voor deze tests en daarna teruggezet; geen packagewijziging. Automatische bouwlog: build OK (20:30:01 en 20:30:23 UTC). Dashboardwoordvoerders, beleid en pushcode niet gewijzigd. Desktop/mobiele signed-out browsercheck geslaagd zonder errors.

Resterend: gebruikerreview van diff; echte ingelogde dashboardmeting en fysieke iPhone cold/warm/resume-meting, plus productiebundel-/na-meting na toegestane publicatie. Geen versnelling op Simone's telefoon bewezen en niets gepubliceerd.