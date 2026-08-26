# Codex Handoff – Poetsrooster

## Context

We willen een nieuwe webapp bouwen voor klassenouders.

De app maakt automatisch een poetsrooster voor een klas.

De gebruiker heeft een bestaand Excelrooster als referentie. De printweergave moet qua structuur daarop lijken.

De app moet uiteindelijk in Docker draaien.

Voor MVP:

- geen backend
- geen account
- geen database
- opslag in browser `localStorage`

---

## Belangrijkste requirements

Lees eerst:

1. `01-PRODUCT-REQUIREMENTS.md`
2. `02-TECHNICAL-DESIGN.md`
3. `03-OPTIMIZER-SPEC.md`
4. `04-UI-AND-PRINT-SPEC.md`

Gebruik deze als source of truth.

---

## Aanbevolen implementatie

Gebruik:

- React
- TypeScript
- Vite
- CSS
- localStorage
- Vitest voor unit tests
- nginx Docker image voor production

Gebruik geen zware externe database- of UI-frameworks voor de MVP.

Een licht componentmodel is gewenst.

---

## Eerste Codex-opdracht

Bouw een volledig werkende MVP.

Acceptance criteria:

### Studenten

- leerlingen toevoegen
- leerlingen verwijderen
- naam wijzigen
- vorig jaar aantal instellen
- per ingestelde poetsdag availability aanvinken

### Planning

- startdatum
- einddatum
- poetsweekdagen
- aantal leerlingen per poetsdag
- rooster genereren

### Uitzonderingen

- datum uitsluiten
- reden toevoegen
- excluded dates blijven zichtbaar
- excluded dates worden nooit automatisch ingepland

### Assignments

- dropdown per slot
- handmatig gekozen student wordt locked
- lock kan worden verwijderd
- optimizer verandert locked assignment nooit

### Optimizer

- respecteert availability
- current-year fairness
- historical previous-year tie-break
- spreiding over het jaar
- moeilijke slots eerst indien praktisch
- waarschuwt bij onmogelijk rooster

### Persistence

- iedere relevante wijziging opslaan in localStorage
- refresh browser herstelt state
- reset-knop wist state

### Statistics

Per leerling:

- vorig jaar
- dit jaar
- totaal
- per poetsweekdag

### Print

- vergelijkbaar met spreadsheet
- dynamische dagkolommen
- excluded days zichtbaar met reden
- sidebar en buttons niet printen

### Docker

Deze commando's moeten werken:

```bash
docker compose build
docker compose up -d
```

De app moet daarna bereikbaar zijn op bijvoorbeeld:

```text
http://localhost:8080
```

---

## Tests

Schrijf unit tests voor optimizer.

Minimaal de scenario's uit `03-OPTIMIZER-SPEC.md`.

Extra test:

- optimizer twee keer achter elkaar draaien
- alle ingevulde assignments blijven gelijk
- alleen assignments met `Nog niet ingevuld` worden alsnog gevuld
- total counts blijven logisch

---

## Kwaliteitscriteria

- Geen gigantisch `App.tsx`
- optimizer los van UI
- storage los van UI
- business types centraal
- datumlogica centraal
- functies zoveel mogelijk puur en testbaar
- geen database-specifieke aannames in componenten

---

## Toekomstige uitbreiding

Houd rekening met:

- database
- gebruikersaccounts
- meerdere klassen
- delen met andere klassenouders
- export/import
- historiek over meerdere schooljaren

Niet nu implementeren.

Wel voorkomen dat de huidige architectuur dit moeilijk maakt.

---

## Belangrijk functioneel detail

Historische fairness betekent NIET:

> degene met vorig jaar de minste beurten onbeperkt extra laten poetsen.

De eerste fairness-doelstelling is een gelijke verdeling in het huidige schooljaar.

Vorige-jaartelling is vooral een tie-breaker wanneer het huidige jaar niet exact gelijk kan eindigen.

---

## Handoff status

Er is nog geen volledig werkende implementatie opgeleverd.

Er was alleen een korte start gemaakt met een HTML/CSS-prototype, maar die code is niet afgerond en niet getest.

Codex kan daarom het beste vanaf een schone repository starten op basis van deze specificaties.
