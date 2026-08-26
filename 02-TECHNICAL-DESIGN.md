# Poetsrooster App – Technical Design

## Voorgestelde stack

Voor de eerste versie is een eenvoudige client-side webapp voldoende.

Aanbevolen:

- HTML
- CSS
- JavaScript of TypeScript
- Bij voorkeur React + Vite als er snel verder ontwikkeld gaat worden
- Geen backend in MVP
- `localStorage` voor persistence
- Docker + nginx voor deployment

Een alternatief is pure vanilla JS. React/TypeScript heeft echter voordelen voor de verdere ontwikkeling, bijvoorbeeld wanneer later database, accounts en meerdere schermen worden toegevoegd.

---

## Aanbevolen projectstructuur

```text
poetsrooster/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── package.json
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types.ts
│   ├── components/
│   │   ├── ClassEditor.tsx
│   │   ├── ScheduleSettings.tsx
│   │   ├── ExceptionEditor.tsx
│   │   ├── ScheduleTable.tsx
│   │   ├── Statistics.tsx
│   │   └── WarningPanel.tsx
│   ├── services/
│   │   ├── storage.ts
│   │   └── optimizer.ts
│   ├── utils/
│   │   ├── dates.ts
│   │   └── schedule.ts
│   └── styles/
│       ├── app.css
│       └── print.css
└── README.md
```

---

## Data model

### Student

```ts
type Student = {
  id: string;
  name: string;
  previousYearCount: number;
  availableWeekdays: number[];
};
```

Weekdays volgens JavaScript conventie of ISO-conventie.

Bij voorkeur expliciet documenteren, bijvoorbeeld:

```text
1 = maandag
2 = dinsdag
3 = woensdag
4 = donderdag
5 = vrijdag
6 = zaterdag
7 = zondag
```

---

### ScheduleSettings

```ts
type ScheduleSettings = {
  className: string;
  startDate: string;
  endDate: string;
  cleaningWeekdays: number[];
  studentsPerCleaningDay: number;
};
```

---

### ExcludedDate

```ts
type ExcludedDate = {
  date: string;
  reason: string;
};
```

---

### Assignment

```ts
type Assignment = {
  studentId: string | null;
  locked: boolean;
  source: "manual" | "optimizer" | null;
  changedFromStudentId?: string | null;
};
```

`changedFromStudentId` bewaart bij een geavanceerde ruil de leerling die op deze plek stond vóór de eerste aanpassing. Ontbreekt het veld, dan is de plek niet als gewijzigd gemarkeerd.

---

### ScheduleDay

```ts
type ScheduleDay = {
  date: string;
  weekday: number;
  excluded: boolean;
  exclusionReason?: string;
  unavailableStudentIds?: string[];
  assignments: Assignment[];
};
```

`unavailableStudentIds` bevat leerlingen van wie de ouder(s)/verzorger(s) op deze specifieke datum niet kunnen. De optimizer en geavanceerde ruilfunctie behandelen deze lijst als harde constraint.

---

### PersistedState

```ts
type PersistedState = {
  version: 1;
  settings: ScheduleSettings;
  students: Student[];
  excludedDates: ExcludedDate[];
  schedule: ScheduleDay[];
};
```

---

## localStorage

Gebruik één centrale key, bijvoorbeeld:

```text
poetsrooster:v1
```

Voorbeeld:

```ts
localStorage.setItem(
  "poetsrooster:v1",
  JSON.stringify(state)
);
```

Maak opslag niet rechtstreeks onderdeel van React-components.

Gebruik een storage service:

```ts
interface StorageProvider {
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
}
```

De eerste implementatie is `LocalStorageProvider`.

Later kan dezelfde interface bijvoorbeeld een REST API gebruiken.

---

## Planning van roosterregels

Maak eerst alle kalenderweken / relevante poetsdagen aan.

Belangrijk:

Het Excelvoorbeeld gebruikt regels per week.

Daarom is een goede interne structuur:

```text
Week start
  - woensdag assignment
  - vrijdag assignment
  - opmerkingen
```

Intern mag dit per datum opgeslagen worden, maar de UI kan ze per kalenderweek groeperen.

---

## Uitzonderingen

Een uitgesloten datum blijft bestaan als roosterregel.

Pseudo:

```ts
if (excludedDates.includes(date)) {
  return {
    date,
    excluded: true,
    exclusionReason: reason,
    assignments: []
  };
}
```

Geen optimizer assignment maken op excluded dates.

---

## Handmatige locks

Wanneer een gebruiker een assignment selecteert:

```ts
assignment = {
  studentId,
  locked: true,
  source: "manual"
};
```

Bij optimalisatie:

```ts
if (assignment.studentId) {
  continue;
}
```

Iedere bestaande toewijzing blijft staan. Alleen assignments zonder `studentId` worden door de optimizer ingevuld; bestaande toewijzingen tellen wel mee voor de verdeling.

---

## Validatie

Controleer minimaal:

- einddatum >= startdatum
- minimaal één poetsdag
- minimaal één leerling
- `studentsPerCleaningDay >= 1`
- geen dubbele studentnamen gewenst
- previousYearCount >= 0
- iedere leerling heeft minimaal één geldige beschikbare poetsdag, tenzij bewust toegestaan

---

## Docker

Aanbevolen multi-stage build.

Voorbeeld:

```dockerfile
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
```

Voor `docker-compose.yml`:

```yaml
services:
  poetsrooster:
    build: .
    ports:
      - "8080:80"
    restart: unless-stopped
```

---

## nginx

Voor een SPA moet nginx routes terugsturen naar `index.html`.

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Print CSS

Gebruik een aparte print stylesheet.

Voorbeelden:

```css
@media print {
  .no-print {
    display: none !important;
  }

  body {
    background: white;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    border: 1px solid #000;
  }

  tr {
    break-inside: avoid;
  }
}
```

Doel: het printresultaat moet meer op Excel lijken dan op een moderne dashboard-interface.

---

## Wat al besproken / gestart was

Er is eerder een eerste prototype-opzet bedacht met:

- linker configuratiekolom
- klasnaam
- lijst met kinderen
- periode
- weekdagen
- kinderen per poetsdag
- uitzonderingen
- knop `Optimale verdeling`
- printknop
- rooster
- statistiekweergave

Er was kort gestart met HTML/CSS-code, maar die implementatie is niet volledig afgerond of getest.

Gebruik deze documenten daarom als functionele basis; beschouw de eerdere code niet als een stabiele codebase.
