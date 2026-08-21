# Poetsrooster

Een lokale React-app waarmee klassenouders een eerlijk poetsrooster maken. Gegevens blijven in de browser via `localStorage`.

## Ontwikkelen

```bash
npm install
npm run dev
```

Maak voor centraal schoolbeheer eerst een lokaal configuratiebestand:

```bash
cp .env.example .env
```

Vervang in `.env` het voorbeeld door een sterk `SCHOOL_ADMIN_PASSWORD`. Dit wachtwoord is alleen nodig om schoolbrede dagen te wijzigen; alle gebruikers kunnen de centrale kalender zonder wachtwoord lezen.

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

Pas daarna `SCHOOL_ADMIN_PASSWORD` in `.env` aan.

```bash
docker compose build
docker compose up -d
```

Open daarna `http://localhost:8080`.

De schoolbrede kalender wordt als JSON bewaard in het permanente Docker-volume `poetsrooster-data`. Het volume blijft bestaan wanneer de container wordt bijgewerkt of vervangen.

## Exporteren

Zodra een rooster is gegenereerd, staan bovenaan drie exportacties:

- `Rooster kopiëren` zet het rooster als tabgescheiden tekst op het klembord, geschikt voor Excel, Google Sheets, Word en e-mail;
- `PDF downloaden` maakt direct een A4-portrait PDF van één pagina;
- `Printen` opent het afdrukvenster van de browser.

## Schoolbrede uitzonderingen

In het onderdeel `Schoolkalender` kun je vakanties, studiedagen en feestdagen beheren die voor iedere klas gelden.

1. Voeg de dagen toe, ook als de huidige klas nog leeg is.
2. Vul het schoolbeheerwachtwoord uit `.env` in.
3. Kies `Opslaan voor alle klassen`.

De server bewaart de kalender centraal. Iedere gebruiker krijgt de actuele schooldagen automatisch bij het openen van de app. Klasspecifieke uitzonderingen blijven apart bestaan en kunnen een schoolbrede reden voor dezelfde datum overschrijven.

Met `JSON exporteren` maak je een back-up. Met `JSON importeren` laad je zo'n back-up in de editor; kies daarna nog `Opslaan voor alle klassen` om de geïmporteerde kalender centraal actief te maken.

## Bijwerken op de server

Na de eerste installatie kan de app vanuit de repositorymap met één commando worden bijgewerkt:

```bash
./update.sh
```

Het script:

- stopt wanneer er lokale, niet-gecommitte wijzigingen zijn;
- haalt de nieuwste versie van `origin/main` op met een veilige fast-forward;
- bouwt de Docker-image opnieuw;
- start of vervangt de container;
- controleert of de app bereikbaar is op `http://127.0.0.1:8080/`.

Voor een andere branch of controle-URL kunnen omgevingsvariabelen worden gebruikt:

```bash
POETSROOSTER_BRANCH=main \
POETSROOSTER_HEALTH_URL=https://voorbeeld.nl/ \
./update.sh
```
