# Korte handleiding voor beheerders

## Eerste installatie

Op de server zijn Git en Docker met Docker Compose nodig.

```bash
git clone https://github.com/ralfvd/poetsrooster.git
cd poetsrooster
cp .env.example .env
```

Open daarna `.env` en vervang de voorbeeldwaarde door een sterk, uniek wachtwoord:

```text
SCHOOL_ADMIN_PASSWORD=zet-hier-een-sterk-uniek-wachtwoord
```

Bewaar `.env` alleen op de server en deel het wachtwoord uitsluitend met schoolbeheerders. Start vervolgens de app:

```bash
docker compose up -d --build
```

De app is standaard bereikbaar via `http://serveradres:8080`. Gebruik HTTPS wanneer de app via internet bereikbaar is.

## Schoolbrede vrije dagen beheren

1. Open in de app het onderdeel **Schoolkalender**.
2. Vul **Van**, **Tot en met** en een reden in, bijvoorbeeld een studiedag of vakantie. Gebruik voor één losse dag tweemaal dezelfde datum.
3. Vul het schoolbeheerwachtwoord uit `.env` in.
4. Kies **Opslaan voor alle klassen**.

De dagen worden centraal bewaard en bij iedere gebruiker automatisch geladen. Maak regelmatig een back-up met **JSON exporteren**. Een back-up terugzetten kan met **JSON importeren**; kies daarna opnieuw **Opslaan voor alle klassen**.

## Wachtwoord wijzigen

Pas `SCHOOL_ADMIN_PASSWORD` in `.env` aan en maak de container opnieuw aan:

```bash
docker compose up -d --force-recreate
```

De opgeslagen schoolkalender blijft hierbij behouden.

## App bijwerken

Voer vanuit de repositorymap uit:

```bash
./update.sh
```

Dit haalt de nieuwste versie op, bouwt de app opnieuw en controleert of deze bereikbaar is. De centrale schoolkalender staat in het permanente Docker-volume `poetsrooster-data` en blijft bij updates bestaan.

## Snelle controles

```bash
docker compose ps
docker compose logs --tail=100
```

Is poort `8080` al bezet, wijzig dan in `docker-compose.yml` de regel `8080:3000` bijvoorbeeld naar `8081:3000` en open daarna poort `8081`.
