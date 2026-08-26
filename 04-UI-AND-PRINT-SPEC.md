# Poetsrooster App – UI and Print Specification

## Richting

De app mag in beheerweergave modern en eenvoudig zijn.

De printweergave moet juist compact en spreadsheet-achtig zijn, vergelijkbaar met het aangeleverde Excelvoorbeeld.

---

## Referentie uit Excel

Het voorbeeld bevat ongeveer deze structuur:

```text
| Week van | Woensdag | Vrijdag | Opmerkingen |
```

Daarnaast staat rechts een statistiekoverzicht per kind.

Voorbeeld:

```text
Kind 1   gemiddeld   8b   7b   6b
Kind 2
Kind 3
...
```

Voor deze app hoeft de exacte statistiekstructuur van het voorbeeld niet letterlijk gevolgd te worden.

Wel moet er een controle-overzicht per leerling zijn.

---

## Hoofdscherm

Aanbevolen desktop-layout:

```text
+----------------------+--------------------------------------+
| Instellingen         | Rooster                              |
|                      |                                      |
| Klas                 | Week | Woensdag | Vrijdag | Opmerking|
| Leerlingen           |                                      |
| Periode              |                                      |
| Poetsdagen           |                                      |
| Uitzonderingen       |                                      |
|                      |                                      |
| [optimaliseren]      | Statistieken                         |
+----------------------+--------------------------------------+
```

Op mobiel:

- instellingen bovenaan
- rooster eronder

---

## Studentenbeheer

Geen textarea als definitieve UI.

Gebruik een editable tabel.

Voorbeeld:

```text
+-----------------------------------------------------+
| Naam             | Vorig jaar | Wo | Vr | Actie    |
+-----------------------------------------------------+
| Kind 1           |     3      | ✓  | ✓  | Verwijder|
| Kind 2           |     2      | ✓  |    | Verwijder|
| Kind 3           |     4      |    | ✓  | Verwijder|
+-----------------------------------------------------+

[ + Kind toevoegen ]
```

Als de ingestelde poetsdagen veranderen, veranderen de availability-kolommen mee.

---

## Roosterbewerking

Iedere rooster-cell moet een dropdown/select kunnen zijn.

Voorbeeld:

```text
Week van     Woensdag          Vrijdag
24-08-2026   [ Kind 1 ▼ ]      [ Kind 2 ▼ ]
31-08-2026   [ Kind 3 ▼ ]      [ Kind 5 ▼ ]
```

Een handmatig gewijzigde cel krijgt visueel een lock-status.

Bijvoorbeeld:

```text
🔒 Kind 3
```

of een subtiele achtergrondkleur.

Niet afhankelijk maken van kleur alleen.

---

## Excluded dates

Een uitgesloten week/dag:

```text
12-10-2026   --                --                herfstvakantie
```

Als maar één poetsdag vervalt:

```text
18-01-2027   --                Kind 7            studiedag woensdag
```

---

## Buttons

Minimaal:

- Kind toevoegen
- Poetsdagen genereren
- Uitzondering toevoegen
- Optimale verdeling
- Geavanceerd: ouder kan niet
- Markeringen wissen
- Automatische toewijzingen wissen
- Printen
- Alles wissen / reset

Voor destructieve acties confirmation vragen.

De geavanceerde bediening staat standaard uit en wordt met een vinkje geactiveerd. Bij iedere actieve poetsdatum verschijnt dan `Kan niet op deze datum`, met een inklapbare lijst van leerlingen. De teller toont hoeveel leerlingen voor die datum verhinderd zijn.

Na een geslaagde ruil krijgen gewijzigde plekken een opvallende markering met `was [naam]`. In print en exports krijgt de nieuwe naam een `*` en vermeldt de kolom Opmerkingen de wijziging als `oude naam → nieuwe naam`.

---

## Status / warnings

Boven het rooster:

```text
96 poetsbeurten
96 ingevuld
31 kinderen
Gemiddeld 3,10 beurten per kind
```

Warning:

```text
⚠ De verdeling is niet volledig gelijk door beperkte beschikbaarheid.
```

---

## Statistiektabel

Voorbeeld:

```text
| Kind | Vorig jaar | Dit jaar | Totaal | Wo | Vr |
|------|------------:|---------:|-------:|---:|---:|
| Jan  | 2           | 4        | 6      | 2  | 2  |
| Piet | 3           | 3        | 6      | 1  | 2  |
```

Sorteer standaard op naam.

Eventueel later:

- sorteren op `dit jaar`
- sorteren op `totaal`

---

## Print layout

In print:

Verbergen:

- buttons
- form controls
- warnings die alleen technisch relevant zijn
- sidebar

Tonen:

- klasnaam
- schooljaar/periode
- rooster
- eventueel compacte statistiektabel

Printstijl:

- witte achtergrond
- zwarte of donkergrijze borders
- kleine font
- duidelijke kolomkop
- geen grote card margins
- geen afgeronde dashboard-blokken

Doel is praktisch gebruik op school, niet een marketingpagina.

---

## A4

Test:

- Chrome print preview
- portrait en landscape
- standaardmarges
- lange schooljaren met meerdere pagina's

Zorg dat tabelheaders op nieuwe pagina's herhaald worden indien browser dit ondersteunt:

```css
thead {
  display: table-header-group;
}
```

Voorkom dat één weekregel over twee pagina's wordt gesplitst:

```css
tr {
  break-inside: avoid;
}
```

---

## Toegankelijkheid

Minimaal:

- labels bij invoervelden
- toetsenbordbediening
- voldoende contrast
- status niet alleen met kleur aangeven
- buttons met begrijpelijke tekst
