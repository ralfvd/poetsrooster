# Poetsrooster

Een React-app waarmee klassenouders een eerlijk poetsrooster maken. Gegevens blijven standaard in de browser via `localStorage`; een ouder kan optioneel een versleutelde serverback-up maken.

Handleidingen:

- [korte handleiding voor ouders](HANDLEIDING-OUDERS.md);
- [installatie- en beheerhandleiding](HANDLEIDING-BEHEERDERS.md).

Per leerling kan `Handmatig` worden aangevinkt. De automatische verdeling slaat deze leerling altijd over; handmatig kan de leerling zo vaak als nodig in het rooster worden geplaatst.

## Ontwikkelen

```bash
npm install
npm run dev
```

Maak voor centraal schoolbeheer eerst een lokaal configuratiebestand:

```bash
cp .env.example .env
```

Vervang in `.env` beide wachtwoordvoorbeelden door sterke, verschillende wachtwoorden. `ACCESS_PASSWORD` beschermt de hele website; `SCHOOL_ADMIN_PASSWORD` is alleen nodig om schoolbrede dagen te wijzigen. Stel optioneel `FEEDBACK_WHATSAPP_NUMBER=31612345678` in om de feedbackknop te tonen.

Tests en productiebuild:

```bash
npm test
npm run build
```

## Docker

Maak voor de eerste start het serverwachtwoord aan:

```bash
cp .env.example .env
```

Pas daarna zowel `ACCESS_PASSWORD` als `SCHOOL_ADMIN_PASSWORD` in `.env` aan.

```bash
docker compose build
docker compose up -d
```

Open daarna `http://localhost:8080`.

De schoolbrede kalender en versleutelde serverback-ups van ouders worden bewaard in het permanente Docker-volume `poetsrooster-data`. Het volume blijft bestaan wanneer de container wordt bijgewerkt of vervangen.

## Exporteren

Zodra een rooster is gegenereerd, staan bovenaan vier exportacties:

- `Rooster kopiëren (bv. voor Excel)` zet het rooster als tabgescheiden tekst op het klembord, geschikt voor Excel, Google Sheets, Word en e-mail;
- `Excel downloaden` maakt een opgemaakt `.xlsx`-bestand met vaste kopregels en afwisselende grijstinten;
- `PDF downloaden` maakt direct een A4-portrait PDF van één pagina;
- `Printen` opent het afdrukvenster van de browser.

## Schoolbrede uitzonderingen

In het onderdeel `Schoolkalender` kun je vakanties, studiedagen en feestdagen beheren die voor iedere klas gelden.

1. Klap onderaan de zijbalk `Schoolkalender voor iedereen` open.
2. Vul het schoolbeheerwachtwoord uit `.env` in en ontgrendel de kalender.
3. Vul per vrije dag of vakantie **Van**, **Tot en met** en een reden in, ook als de huidige klas nog leeg is.
4. Kies `Opslaan voor alle klassen`.

De server bewaart de kalender centraal. Iedere gebruiker krijgt de actuele schooldagen automatisch bij het openen van de app. Klasspecifieke uitzonderingen blijven apart bestaan en kunnen een schoolbrede reden voor dezelfde datum overschrijven.

Met `JSON exporteren` maak je een back-up. Met `JSON importeren` laad je zo'n back-up in de editor; kies daarna nog `Opslaan voor alle klassen` om de geïmporteerde kalender centraal actief te maken.

## Bewerkbaar rooster overzetten

Bij `Back-up & import` kan een gebruiker het volledige poetsrooster downloaden. Dit JSON-bestand bevat de klasinstellingen, leerlingen, klasuitzonderingen en alle automatische en handmatige toewijzingen. Kies op een andere computer `Back-up importeren` om ermee verder te werken. De actuele centrale schoolkalender wordt na het importeren automatisch toegepast.

Als alternatief kan een ouder het onderdeel uitklappen en een versleutelde serverback-up maken. De combinatie van de voornaam van de ouder en een wachtwoord van minimaal 8 tekens geeft later weer toegang. Bij het opslaan moet het wachtwoord tweemaal worden ingevuld. Een bestaande combinatie wordt geweigerd en nooit overschreven; dezelfde voornaam met een ander wachtwoord is wel toegestaan. De server bewaart geen leesbaar wachtwoord en versleutelt de volledige roosterinhoud. Gebruik deze functie via internet uitsluitend achter HTTPS.

## Bijwerken op de server

Na de eerste installatie kan de app vanuit de repositorymap met één commando worden bijgewerkt:

```bash
./update.sh
```

Het script:

- stopt wanneer er lokale, niet-gecommitte wijzigingen zijn;
- controleert eerst of `origin/main` een nieuwere Git-revisie bevat;
- stopt zonder Docker-build of containerherstart wanneer er geen nieuwe versie is;
- haalt een nieuwe versie op met een veilige fast-forward;
- bouwt alleen bij een nieuwe versie de Docker-image opnieuw;
- start of vervangt de container;
- controleert of de app bereikbaar is op `http://127.0.0.1:8080/`.

Voor een andere branch of controle-URL kunnen omgevingsvariabelen worden gebruikt:

```bash
POETSROOSTER_BRANCH=main \
POETSROOSTER_HEALTH_URL=https://voorbeeld.nl/ \
./update.sh
```

Als GitHub geen nieuwere revisie bevat, meldt het script welke versie al draait en verandert het niets aan Docker of de container.
