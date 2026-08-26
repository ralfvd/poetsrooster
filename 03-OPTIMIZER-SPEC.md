# Poetsrooster App – Optimizer Specification

## Doel

Maak een rooster dat onder harde randvoorwaarden zo eerlijk mogelijk is.

Dit is een klein constraint scheduling-probleem.

De MVP hoeft geen externe solver te gebruiken. Een goede greedy / heuristic optimizer is waarschijnlijk voldoende.

Als later blijkt dat combinaties complexer worden, kan eventueel een solver zoals OR-Tools toegevoegd worden.

---

## Harde constraints

Deze mogen nooit automatisch geschonden worden.

### H1. Locked assignments blijven staan

Een handmatig ingevulde assignment is immutable tijdens optimalisatie.

### H2. Beschikbaarheid per kind

Een kind mag alleen automatisch ingepland worden op een weekdag die in `availableWeekdays` staat.

### H3. Geen excluded dates

Op vakantie-, studie- of andere uitgesloten dagen worden geen leerlingen ingepland.

### H4. Geen dubbel kind op hetzelfde poetsmoment

Als twee kinderen op één poetsdag nodig zijn, mag dezelfde leerling maar één keer voorkomen.

### H5. Geldige leerling

Iedere assignment verwijst naar een bestaande leerling.

---

### H6. Minimaal vier weken tussen automatische beurten

Een automatisch geplande beurt moet minimaal 28 dagen van iedere andere beurt van dezelfde leerling liggen. Handmatig vastgezette beurten mogen wel dichter bij elkaar staan. Als er voor een slot geen geldige automatische kandidaat overblijft, blijft het slot leeg en verschijnt er een waarschuwing.

---

### H7. Vooraf ingestelde verhindering op een datum

Als een leerling in `unavailableStudentIds` van een poetsdatum staat, mag de optimizer die leerling niet op die datum plaatsen. Een algemene beschikbaarheid op die weekdag heft deze specifieke verhindering niet op.

---

## Zachte constraints / optimalisatiedoelen

In volgorde van belang:

### S1. Huidig schooljaar zo gelijk mogelijk

Minimaliseer verschil tussen hoogste en laagste `currentYearCount`.

Bijvoorbeeld:

```text
3,3,3,3,4
```

is beter dan:

```text
2,3,3,4,4
```

---

### S2. Historische correctie

Als meerdere leerlingen gelijk geschikt zijn voor een beurt:

Geef voorkeur aan degene met het laagste:

```text
previousYearCount + currentYearCount
```

Hierdoor worden verschillen uit vorig jaar geleidelijk gecorrigeerd.

Belangrijk:

Current-year gelijkheid blijft belangrijk.

Voorkom dat iemand die vorig jaar 0 keer gepoetst heeft nu bijvoorbeeld 8 keer wordt ingepland terwijl anderen 2 keer krijgen.

Een praktische scoring kan daarom beide combineren.

---

### S3. Spreiding over het jaar

Verdeel de beurten bovenop de harde ondergrens van vier weken zo gelijkmatig mogelijk over het jaar.

Gebruik bijvoorbeeld:

- dagen sinds laatste beurt
- aantal weken sinds laatste beurt

Hoe langer geleden, hoe aantrekkelijker kandidaat.

---

### S4. Weekdagspreiding

Als een leerling meerdere dagen beschikbaar is, probeer niet alle beurten op dezelfde weekdag te zetten.

Dit is een lagere prioriteit dan fairness.

---

### S5. Random tie-break

Als kandidaten verder exact gelijk scoren:

- random shuffle
- of seeded random

Seeded random heeft als voordeel dat optimaliseren met dezelfde invoer reproduceerbaar kan zijn.

---

## Minimale aanpassing na de verdeling

Wanneer een ouder/verzorger niet kan op een toegewezen datum, zoekt de geavanceerde aanpassing eerst een directe ruil. Als die niet geldig is, wordt een zo kort mogelijke ruilketen van maximaal vier plekken gezocht.

De aanpassing:

- wijzigt geen handmatig vastgezette plekken;
- houdt de opgegeven beschikbare poetsdagen als harde grens aan;
- houdt vooraf ingestelde verhinderingen per datum als harde grens aan;
- geeft bij gelijke oplossingen voorkeur aan behoud van dezelfde weekdag;
- houdt voor automatisch geplaatste beurten minimaal 28 dagen afstand aan;
- behoudt het aantal beurten per leerling doordat alleen namen worden geruild;
- markeert per gewijzigde plek welke leerling daar in de eerdere verdeling stond.

De gebruiker kan de markeringen wissen wanneer het aangepaste rooster het nieuwe uitgangspunt wordt.

---

## Voorgestelde heuristic

Voor iedere vrije assignment-slot:

1. Bepaal alle geldige kandidaten.
2. Verwijder kandidaten die niet beschikbaar zijn op die weekday.
3. Verwijder leerlingen die al op hetzelfde poetsmoment staan.
4. Bereken scores.
5. Kies kandidaat met beste score.
6. Update tijdelijke tellingen.
7. Ga naar volgende slot.

---

## Slotvolgorde

Niet simpelweg altijd chronologisch invullen als dit structurele bias geeft.

Een bruikbare aanpak:

1. Maak alle vrije slots.
2. Shuffle slots licht of werk per week.
3. Vul slots iteratief.
4. Eventueel tweede optimalisatiepass uitvoeren.

Een alternatief:

- eerst de slots invullen waarvoor het minste aantal kandidaten beschikbaar is

Dit is een bekende CSP-heuristic: `minimum remaining values`.

Dat voorkomt dat moeilijke dagen pas aan het einde overblijven.

Voorbeeld:

- vrijdag: slechts 8 kinderen beschikbaar
- woensdag: 28 kinderen beschikbaar

Plan vrijdag eerst.

---

## Candidate score

Een mogelijke score:

```ts
score =
  currentYearCount * 1000 +
  combinedYearCount * 100 +
  recencyPenalty * 10 +
  weekdayConcentrationPenalty;
```

Lager is beter.

Waar:

```ts
combinedYearCount =
  previousYearCount + currentYearCount
```

`recencyPenalty` is hoger als de vorige poetsbeurt recent was.

Dit is slechts een eerste voorstel.

De optimizer moet met tests gevalideerd worden.

---

## Betere fairness-methode

Een robuustere vergelijking tussen kandidaten kan lexicografisch:

```text
1. currentYearCount
2. previousYearCount + currentYearCount
3. recency
4. countOnThisWeekday
5. random
```

Dus:

```ts
sortBy([
  currentYearCount,
  historicalCombinedCount,
  recencyPenalty,
  weekdayCount,
  randomTieBreak
])
```

Dit voorkomt arbitraire gewichtskeuzes.

Aanbevolen voor de MVP.

---

## Locked assignments meenemen in tellingen

Voordat automatische slots worden ingevuld:

- tel alle locked assignments mee in `currentYearCount`
- tel hun datum mee voor recency
- tel hun weekday mee

Zo vult de optimizer alleen het resterende rooster aan.

---

## Ongeldige handmatige assignment

Als gebruiker handmatig een kind kiest dat die dag niet beschikbaar is:

Toon bijvoorbeeld:

```text
Kind 12 staat niet als beschikbaar op vrijdag.
Toch toewijzen?
```

Na bevestiging:

```ts
{
  studentId: "...",
  locked: true,
  source: "manual"
}
```

Deze override hoeft niet te betekenen dat de beschikbaarheidsinstelling wordt aangepast.

---

## Onmogelijke planning

Als voor een slot geen kandidaat beschikbaar is:

Laat het slot leeg en genereer warning.

Bijvoorbeeld:

```text
Geen beschikbare leerling voor vrijdag 12 februari 2027.
```

Optimalisatie mag niet crashen.

---

## Analyse-output

Laat na optimalisatie statistieken zien:

- totaal aantal actieve slots
- totaal aantal ingevulde slots
- aantal lege slots
- minimum aantal beurten per kind
- maximum aantal beurten per kind
- gemiddelde
- standaarddeviatie optioneel
- waarschuwingen

Per kind:

```text
naam
vorig jaar
dit jaar
totaal
woensdag
vrijdag
```

---

## Testscenario's

### Scenario A – volledig vrij

30 kinderen.
Iedereen beschikbaar woensdag en vrijdag.
60 slots.

Verwachting:

Iedereen exact 2 keer.

---

### Scenario B – restslots

31 kinderen.
96 slots.

Verwachting:

- vrijwel iedereen 3 keer
- 3 leerlingen 4 keer
- historische telling bepaalt bij voorkeur wie die extra beurt krijgt

---

### Scenario C – beperkte vrijdaggroep

30 kinderen.

- 10 alleen vrijdag
- 20 woensdag + vrijdag

De optimizer moet vrijdag correct kunnen vullen zonder aan het einde vast te lopen.

---

### Scenario D – locked assignments

5 handmatige assignments vooraf.

Na optimizer:

- deze 5 staan exact ongewijzigd
- rest is eromheen geoptimaliseerd

---

### Scenario E – excluded week

Herfstvakantie bevat woensdag + vrijdag.

Verwachting:

- beide dagen zichtbaar in rooster
- geen assignment
- reden zichtbaar
- niet meegerekend als beschikbare poetsbeurt

---

### Scenario F – onmogelijk

Vrijdag is poetsdag.
Geen enkel kind is vrijdag beschikbaar.

Verwachting:

- rooster wordt gegenereerd
- vrijdag blijft leeg
- duidelijke waarschuwing
