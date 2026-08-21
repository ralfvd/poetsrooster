# Poetsrooster

Een lokale React-app waarmee klassenouders een eerlijk poetsrooster maken. Gegevens blijven in de browser via `localStorage`.

## Ontwikkelen

```bash
npm install
npm run dev
```

Tests en productiebuild:

```bash
npm test
npm run build
```

## Docker

```bash
docker compose build
docker compose up -d
```

Open daarna `http://localhost:8080`.

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
