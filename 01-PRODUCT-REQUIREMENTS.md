# Poetsrooster App – Product Requirements

## Doel

Bouw een eenvoudige webapp voor klassenouders waarmee een eerlijk poetsrooster voor een schooljaar kan worden gemaakt.

De eerste versie moet volledig lokaal in de browser werken en data opslaan in `localStorage`. Als het concept goed werkt, moet de architectuur later eenvoudig uitgebreid kunnen worden met een database/backend.

De applicatie moet uiteindelijk in Docker kunnen draaien.

---

## Hoofdfunctionaliteit

### 1. Klassenlijst beheren

Per kind moet opgeslagen worden:

- Naam
- Aantal poetsbeurten in het vorige schooljaar
- Beschikbaarheid per weekdag

Voorbeeld:

| Kind | Vorig jaar | Woensdag | Vrijdag |
|---|---:|---|---|
| Kind 1 | 3 | Ja | Ja |
| Kind 2 | 2 | Ja | Nee |
| Kind 3 | 4 | Nee | Ja |

Alleen de weekdagen waarop daadwerkelijk gepoetst wordt hoeven als beschikbaarheidsopties zichtbaar te zijn.

---

### 2. Periode instellen

De gebruiker stelt in:

- Startdatum
- Einddatum
- Welke weekdagen poetsdagen zijn
- Hoeveel kinderen per poetsdag nodig zijn

Voorbeeld:

- Periode: 24 augustus 2026 t/m 19 juli 2027
- Poetsdagen: woensdag en vrijdag
- 1 kind per poetsdag

---

### 3. Uitzonderingen / uitgesloten dagen

Dagen moeten uitgesloten kunnen worden, bijvoorbeeld:

- Vakantie
- Studiedag
- Feestdag
- Laatste schooldag
- Andere reden

Belangrijk:

Een uitgesloten dag wordt niet uit het rooster verwijderd.

De datum moet zichtbaar blijven in het rooster, maar zonder toewijzing, met bijvoorbeeld:

- `--` in de poetskolom
- Reden in kolom `Opmerkingen`

Dit sluit aan bij het Excelvoorbeeld.

---

### 4. Automatische optimale verdeling

De app moet automatisch een zo eerlijk mogelijk rooster maken.

Prioriteiten van de optimizer:

1. Handmatig ingevulde / vastgezette toewijzingen nooit wijzigen.
2. Een kind alleen inplannen op dagen waarop het beschikbaar is.
3. Een kind nooit dubbel op hetzelfde poetsmoment zetten.
4. Het aantal poetsbeurten in het huidige schooljaar zo gelijk mogelijk verdelen.
5. Als niet iedereen exact even vaak kan poetsen, krijgen kinderen die vorig jaar minder vaak gepoetst hebben voorrang op extra beurten.
6. Beurten zo goed mogelijk over het schooljaar verspreiden.
7. Tussen automatisch geplande beurten van hetzelfde kind altijd minimaal vier weken houden.
8. Bij volledig gelijke kandidaten een neutrale/random tie-breaker gebruiken.

---

## Historische eerlijkheid

De verdeling moet niet alleen binnen één schooljaar eerlijk zijn, maar over meerdere jaren.

Voorbeeld:

Er zijn 31 kinderen en 96 poetsbeurten.

Dan kunnen 28 kinderen 3 keer poetsen en moeten 3 kinderen 4 keer poetsen.

De 3 extra beurten moeten bij voorkeur gaan naar kinderen die vorig jaar minder vaak gepoetst hebben.

Voorbeeld:

| Kind | Vorig jaar | Dit jaar | Totaal |
|---|---:|---:|---:|
| Anna | 2 | 4 | 6 |
| Bram | 2 | 4 | 6 |
| Chris | 2 | 4 | 6 |
| Daan | 3 | 3 | 6 |
| Emma | 4 | 3 | 7 |

De optimizer hoeft niet per se het absolute totaal over alle jaren mathematisch perfect te maken, maar moet vorige-jaarinformatie gebruiken als duidelijke tie-breaker.

---

## Handmatige toewijzingen

De gebruiker moet in het rooster handmatig een naam kunnen kiezen.

Zo'n toewijzing moet automatisch als `locked` / vastgezet worden beschouwd.

Bij opnieuw drukken op `Optimale verdeling`:

- alle reeds ingevulde assignments blijven staan, ongeacht hun bron of lockstatus
- alleen assignments met `Nog niet ingevuld` worden automatisch verdeeld
- bestaande assignments tellen mee bij het bepalen van een eerlijke verdeling van de lege plekken

De gebruiker moet een lock ook weer kunnen verwijderen.

---

## Handmatige override van beschikbaarheid

Normaal mag een kind alleen worden ingepland op toegestane dagen.

Als de gebruiker handmatig een kind kiest op een niet-beschikbare dag:

- Toon een waarschuwing
- Sta bewust overschrijven toe
- Markeer de assignment als handmatig/vastgezet

De automatische optimizer mag nooit zelf zo'n conflict creëren.

---

## Minimale wijziging na verdeling

Vóór de verdeling moet een geavanceerde modus per poetsdatum laten vastleggen welke ouders/verzorgers dan niet kunnen. De automatische optimizer mag de bijbehorende leerlingen niet op die specifieke datum plaatsen. Deze datumuitzondering komt bovenop de algemene beschikbare weekdagen.

Na de optimale verdeling moet de gebruiker bij een automatische beurt kunnen aangeven dat de betreffende ouder/verzorger niet op die datum kan.

De app zoekt dan eerst een directe ruil en zo nodig een korte ruilketen. Daarbij gelden:

- zo weinig mogelijk gewijzigde plekken;
- alleen beschikbare poetsdagen;
- voorkeur voor behoud van dezelfde weekdag;
- minimaal vier weken tussen automatisch geplande beurten;
- handmatig vastgezette plekken blijven staan;
- iedere wijziging toont de eerdere en nieuwe leerlingnaam.

De markering moet ook zichtbaar zijn in print, PDF, Excel en gekopieerde roosters.

---

## Waarschuwingen

De app moet aangeven wanneer een perfecte verdeling niet mogelijk is.

Voorbeeld:

> Verdeling beperkt door beschikbaarheid. Sommige kinderen kunnen alleen op woensdag, waardoor niet iedereen exact even vaak kan worden ingepland.

Ook nuttig:

- aantal niet ingevulde plekken
- kinderen die relatief vaak ingepland zijn
- kinderen die nog niet of nauwelijks ingepland zijn
- dagen waarvoor geen geldige kandidaat beschikbaar is

---

## Printweergave

De printversie moet sterk lijken op het bestaande Excelvoorbeeld.

Voorbeeldstructuur:

| Week van | Woensdag | Vrijdag | Opmerkingen |
|---|---|---|---|
| 24-aug-26 | Kind 1 | Kind 2 | |
| 31-aug-26 | Kind 3 | Kind 5 | |
| 07-sep-26 | Kind 18 | Kind 31 | |
| 12-okt-26 | -- | -- | herfstvakantie |

Als andere poetsdagen worden gekozen, moeten de kolommen dynamisch veranderen.

De printversie moet:

- overzichtelijk op A4 werken
- geen beheerknoppen tonen
- een klasnaam tonen
- eventueel schooljaar/periode tonen
- meerdere pagina's netjes ondersteunen

---

## Statistieken

Naast of onder het rooster moet een controle-overzicht staan.

Per kind:

- aantal vorig jaar
- aantal huidig schooljaar
- totaal over beide jaren
- eventueel verdeling per weekdag

Dit helpt de klassenouder controleren of het rooster eerlijk is.

---

## Eerste versie

De eerste versie hoeft nog geen:

- login
- accounts
- backend
- database
- cloud-sync
- multi-user collaboration

Alles mag eerst in `localStorage`.

De code moet wel zo opgezet zijn dat later een storage abstraction toegevoegd kan worden.
