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
ACCESS_PASSWORD=zet-hier-een-ander-sterk-uniek-wachtwoord
FEEDBACK_WHATSAPP_NUMBER=
```

`ACCESS_PASSWORD` beschermt de volledige website. `SCHOOL_ADMIN_PASSWORD` is een extra beheerderswachtwoord voor het wijzigen van de centrale schoolkalender.
`FEEDBACK_WHATSAPP_NUMBER` is optioneel en toont de knop **Feedback via WhatsApp**. Gebruik het internationale formaat zonder `+`, spaties of streepjes, bijvoorbeeld `31612345678`. Laat de waarde leeg om de knop te verbergen.

Bewaar `.env` alleen op de server. Deel `SCHOOL_ADMIN_PASSWORD` uitsluitend met schoolbeheerders; geef ouders bij voorkeur de unieke toegangslink in plaats van het losse `ACCESS_PASSWORD`. Start vervolgens de app:

```bash
docker compose up -d --build
```

De app is standaard bereikbaar via `http://serveradres:8080`. Gebruik HTTPS wanneer de app via internet bereikbaar is.

## Website openen

Wie de basislink opent zonder geldige cookie, krijgt een wachtwoordveld voor `ACCESS_PASSWORD`.

De server maakt daarnaast een unieke toegangsroute die meteen een cookie voor 30 dagen plaatst. Bekijk deze route na het starten met:

```bash
docker compose logs --tail=30
```

Zoek naar `Unieke toegangsroute`, plak het getoonde pad achter het serveradres en deel die volledige link alleen met bevoegde ouders. Het wachtwoord zelf staat niet in de link. Na één bezoek werkt ook de gewone basislink in dezelfde browser.

Als `ACCESS_PASSWORD` wordt gewijzigd, worden bestaande cookies en de oude unieke link automatisch ongeldig. Maak de container daarna opnieuw aan met `docker compose up -d --force-recreate`.

Na een wijziging van `FEEDBACK_WHATSAPP_NUMBER` moet de container eveneens opnieuw worden aangemaakt met `docker compose up -d --force-recreate`; opnieuw bouwen is niet nodig.

## Schoolbrede vrije dagen beheren

1. Klap onderaan de zijbalk **Schoolkalender voor iedereen** open.
2. Vul het schoolbeheerwachtwoord uit `.env` in en kies **Schoolkalender ontgrendelen**.
3. Vul **Van**, **Tot en met** en een reden in, bijvoorbeeld een studiedag of vakantie. Bij het kiezen van **Van** wordt **Tot en met** eerst op dezelfde dag gezet.
4. Kies **Opslaan voor alle klassen**.

De dagen worden centraal bewaard en bij iedere gebruiker automatisch geladen. Maak regelmatig een back-up met **JSON exporteren**. Een back-up terugzetten kan met **JSON importeren**; kies daarna opnieuw **Opslaan voor alle klassen**.

## Wachtwoord wijzigen

Pas `SCHOOL_ADMIN_PASSWORD` in `.env` aan en maak de container opnieuw aan:

```bash
docker compose up -d --force-recreate
```

De opgeslagen schoolkalender blijft hierbij behouden.

## Optionele serverback-ups van ouders

Bij **Back-up & import** kunnen ouders hun volledige bewerkbare rooster optioneel op de server bewaren. Zij gebruiken daarvoor hun voornaam en een wachtwoord van minimaal 8 tekens, dat bij het opslaan tweemaal moet worden ingevuld. Met dezelfde combinatie kan het rooster later op een ander apparaat worden opgehaald.

- Een bestaande combinatie wordt nooit overschreven.
- De voornaam is niet hoofdlettergevoelig: `Ralf` en `ralf` gelden als dezelfde naam.
- Dezelfde voornaam met een ander wachtwoord mag wel bestaan.
- Wachtwoorden worden niet opgeslagen en kunnen niet worden hersteld.
- De roosterinhoud wordt met AES-256-GCM versleuteld opgeslagen in `ouderroosters.json` in het permanente Docker-volume `poetsrooster-data`.
- Het volledige Docker-volume moet daarom in de serverback-up worden meegenomen.

Gebruik deze functie alleen via HTTPS. Zonder HTTPS kunnen voornaam, wachtwoord en roostergegevens tijdens het versturen worden onderschept.

## App bijwerken

Voer vanuit de repositorymap uit:

```bash
./update.sh
```

Dit controleert eerst of GitHub een nieuwere revisie bevat. Alleen dan haalt het script de versie op, bouwt het de app opnieuw, vervangt het de container en controleert het of de app bereikbaar is. Als er geen nieuwe versie is, stopt het zonder Docker-build of containerherstart. De centrale schoolkalender en versleutelde ouderback-ups staan in het permanente Docker-volume `poetsrooster-data` en blijven bij updates bestaan.

Rechtsonder in de app staat de korte Git-revisie, bijvoorbeeld `76ac6c7`. Deze moet overeenkomen met de versie die `update.sh` na een geslaagde update meldt.

## Snelle controles

```bash
docker compose ps
docker compose logs --tail=100
```

Is poort `8080` al bezet, wijzig dan in `docker-compose.yml` de regel `8080:3000` bijvoorbeeld naar `8081:3000` en open daarna poort `8081`.
