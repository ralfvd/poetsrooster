import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultDataDirectory = join(currentDirectory, "data");
const defaultDistDirectory = join(currentDirectory, "dist");
const scrypt = promisify(scryptCallback);
const maximumParentRosters = 500;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function html(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/html; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...extraHeaders,
  });
  response.end(body);
}

function loginPage(message = "", configured = true) {
  const notice = configured
    ? message
    : "Toegang is nog niet ingesteld. Voeg ACCESS_PASSWORD toe aan .env en start de container opnieuw.";
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Toegang - Poetsrooster</title>
  <style>
    :root { font-family: system-ui, sans-serif; color: #1d2927; background: #f4f1e9; }
    * { box-sizing: border-box; }
    body { display: grid; min-height: 100vh; margin: 0; padding: 1rem; place-items: center; }
    main { width: min(100%, 390px); padding: 2rem; border: 1px solid #dedbd2; border-radius: 18px; background: #fffdf8; box-shadow: 0 16px 45px rgb(40 55 51 / 10%); }
    h1 { margin: 0 0 .5rem; font-family: Georgia, serif; font-size: 2rem; }
    p { margin: 0 0 1.2rem; color: #65716e; line-height: 1.45; }
    .tagline { margin-bottom: 1.5rem; color: #165c56; font-size: .78rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .notice { padding: .7rem; border-radius: 8px; color: #7b342c; background: #f7e2de; font-size: .85rem; }
    label { display: grid; gap: .45rem; font-size: .85rem; font-weight: 700; }
    input { width: 100%; padding: .75rem; border: 1px solid #b8c9c5; border-radius: 9px; font: inherit; }
    button { width: 100%; margin-top: .8rem; padding: .75rem; border: 0; border-radius: 9px; color: white; background: #165c56; font: inherit; font-weight: 800; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>Poetsrooster</h1>
    <p class="tagline">Eerlijk verdeeld, slim geregeld</p>
    <p>Vul het toegangswachtwoord in om verder te gaan.</p>
    ${notice ? `<p class="notice" role="alert">${notice}</p>` : ""}
    ${configured ? `<form method="post" action="/api/access/login">
      <label>Wachtwoord<input name="password" type="password" autocomplete="current-password" required autofocus></label>
      <button type="submit">Open poetsrooster</button>
    </form>` : ""}
  </main>
</body>
</html>`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function object(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ParentRosterError(400, message);
  return value;
}

function validWeekday(value) {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

function limitedString(value, maximumLength, message, allowEmpty = false) {
  if (typeof value !== "string" || value.length > maximumLength || (!allowEmpty && !value.trim())) {
    throw new ParentRosterError(400, message);
  }
  return value;
}

export class ParentRosterError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function normalizeParentName(value) {
  if (typeof value !== "string") throw new ParentRosterError(400, "Vul de voornaam van de ouder in.");
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name || name.length > 60 || !/^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u.test(name)) {
    throw new ParentRosterError(400, "Vul een geldige voornaam van maximaal 60 tekens in.");
  }
  return name;
}

function validateParentPassword(password, confirmation) {
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    throw new ParentRosterError(400, "Gebruik een wachtwoord van minimaal 8 en maximaal 128 tekens.");
  }
  if (confirmation !== undefined && password !== confirmation) {
    throw new ParentRosterError(400, "De twee wachtwoorden zijn niet hetzelfde.");
  }
  return password;
}

export function validateParentRosterState(input) {
  const state = object(input, "De roostergegevens ontbreken of zijn ongeldig.");
  if (state.version !== 1) throw new ParentRosterError(400, "Deze versie van de roostergegevens wordt niet ondersteund.");
  const settings = object(state.settings, "De planning is ongeldig.");
  if (!validDate(settings.startDate) || !validDate(settings.endDate) || settings.endDate < settings.startDate ||
      !Array.isArray(settings.cleaningWeekdays) || !settings.cleaningWeekdays.every(validWeekday) ||
      !Number.isInteger(settings.studentsPerCleaningDay) ||
      settings.studentsPerCleaningDay < 1 || settings.studentsPerCleaningDay > 20) {
    throw new ParentRosterError(400, "De planning is ongeldig.");
  }
  const className = limitedString(settings.className, 100, "De klasnaam is te lang.", true);
  if (!Array.isArray(state.students) || state.students.length > 500 ||
      !Array.isArray(state.excludedDates) || state.excludedDates.length > 1000 ||
      !Array.isArray(state.schedule) || state.schedule.length > 1000) {
    throw new ParentRosterError(400, "De roostergegevens zijn te groot of ongeldig.");
  }

  const students = state.students.map((value) => {
    const student = object(value, "Een leerling is ongeldig.");
    const id = limitedString(student.id, 100, "Een leerling mist een geldig kenmerk.");
    const name = limitedString(student.name, 100, "Een leerlingnaam is te lang.", true);
    if (!Number.isInteger(student.previousYearCount) || student.previousYearCount < 0 ||
        student.previousYearCount > 10_000 || typeof student.manualOnly !== "boolean" ||
        !Array.isArray(student.availableWeekdays) || student.availableWeekdays.length > 7 ||
        !student.availableWeekdays.every(validWeekday)) {
      throw new ParentRosterError(400, "Een leerling bevat ongeldige gegevens.");
    }
    return {
      id,
      name,
      previousYearCount: student.previousYearCount,
      manualOnly: student.manualOnly,
      availableWeekdays: [...new Set(student.availableWeekdays)],
    };
  });
  const studentIds = new Set(students.map((student) => student.id));
  if (studentIds.size !== students.length) throw new ParentRosterError(400, "Leerlingkenmerken moeten uniek zijn.");

  const excludedDates = state.excludedDates.map((value) => {
    const exclusion = object(value, "Een klasuitzondering is ongeldig.");
    if (!validDate(exclusion.date)) throw new ParentRosterError(400, "Een klasuitzondering bevat geen geldige datum.");
    return {
      id: limitedString(exclusion.id, 100, "Een klasuitzondering mist een geldig kenmerk."),
      date: exclusion.date,
      reason: limitedString(exclusion.reason, 200, "Een klasuitzondering mist een geldige reden.").trim(),
    };
  });

  const schedule = state.schedule.map((value) => {
    const day = object(value, "Een poetsdag is ongeldig.");
    if (!validDate(day.date) || !validWeekday(day.weekday) || typeof day.excluded !== "boolean" ||
        !Array.isArray(day.assignments) || day.assignments.length > 20) {
      throw new ParentRosterError(400, "Een poetsdag bevat ongeldige gegevens.");
    }
    const exclusionReason = day.exclusionReason === undefined
      ? undefined
      : limitedString(day.exclusionReason, 200, "Een poetsdag bevat een ongeldige reden.", true);
    const assignments = day.assignments.map((value) => {
      const assignment = object(value, "Een toewijzing is ongeldig.");
      const studentId = assignment.studentId === null ? null : assignment.studentId;
      if (studentId !== null && (typeof studentId !== "string" || !studentIds.has(studentId))) {
        throw new ParentRosterError(400, "Een toewijzing verwijst naar een onbekende leerling.");
      }
      if (typeof assignment.locked !== "boolean" || ![null, "manual", "optimizer"].includes(assignment.source)) {
        throw new ParentRosterError(400, "Een toewijzing bevat ongeldige gegevens.");
      }
      return { studentId, locked: assignment.locked, source: assignment.source };
    });
    return { date: day.date, weekday: day.weekday, excluded: day.excluded, exclusionReason, assignments };
  });

  const validated = {
    version: 1,
    settings: {
      className,
      startDate: settings.startDate,
      endDate: settings.endDate,
      cleaningWeekdays: [...new Set(settings.cleaningWeekdays)],
      studentsPerCleaningDay: settings.studentsPerCleaningDay,
    },
    students,
    excludedDates,
    schedule,
  };
  if (Buffer.byteLength(JSON.stringify(validated)) > 2_000_000) {
    throw new ParentRosterError(413, "De roostergegevens zijn te groot om op de server te bewaren.");
  }
  return validated;
}

function parentNameKey(parentName) {
  return createHash("sha256").update(parentName.toLocaleLowerCase("nl")).digest("base64url");
}

async function deriveParentRosterKey(password, salt) {
  return scrypt(password, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

async function encryptParentRoster(state, password, nameKey) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveParentRosterKey(password, salt);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`poetsrooster-ouderrooster:v1:${nameKey}`));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(state), "utf8"), cipher.final()]);
    return {
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    };
  } finally {
    key.fill(0);
  }
}

async function decryptParentRoster(record, password) {
  const key = await deriveParentRosterKey(password, Buffer.from(record.salt, "base64"));
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.iv, "base64"));
    decipher.setAAD(Buffer.from(`poetsrooster-ouderrooster:v1:${record.nameKey}`));
    decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(record.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
    return validateParentRosterState(JSON.parse(plaintext));
  } finally {
    key.fill(0);
  }
}

async function tryDecryptParentRoster(record, password) {
  try {
    return await decryptParentRoster(record, password);
  } catch {
    return null;
  }
}

function validateParentRosterFile(input) {
  if (!input || typeof input !== "object" || input.version !== 1 || !Array.isArray(input.records) ||
      input.records.length > maximumParentRosters) {
    throw new Error("Het bestand met ouderroosters is ongeldig.");
  }
  for (const record of input.records) {
    if (!record || typeof record !== "object" || typeof record.id !== "string" ||
        typeof record.nameKey !== "string" || typeof record.createdAt !== "string" ||
        (record.updatedAt !== undefined && typeof record.updatedAt !== "string") ||
        typeof record.salt !== "string" || typeof record.iv !== "string" ||
        typeof record.authTag !== "string" || typeof record.ciphertext !== "string") {
      throw new Error("Een opgeslagen ouderrooster is ongeldig.");
    }
  }
  return input;
}

export async function createParentRosterStore(dataDirectory = defaultDataDirectory) {
  const dataFile = join(dataDirectory, "ouderroosters.json");
  await mkdir(resolve(dataFile, ".."), { recursive: true });
  try {
    await access(dataFile);
  } catch {
    await writeFile(dataFile, JSON.stringify({ version: 1, records: [] }, null, 2), { mode: 0o600 });
  }
  let pendingOperation = Promise.resolve();
  const exclusive = (operation) => {
    const result = pendingOperation.then(operation, operation);
    pendingOperation = result.catch(() => undefined);
    return result;
  };
  const saveFile = async (file) => {
    const temporaryFile = `${dataFile}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(file, null, 2), { mode: 0o600 });
    await rename(temporaryFile, dataFile);
  };

  return {
    create(input) {
      return exclusive(async () => {
        const request = object(input, "De gegevens voor de serverback-up ontbreken.");
        const parentName = normalizeParentName(request.parentName);
        const password = validateParentPassword(request.password, request.passwordConfirmation);
        const state = validateParentRosterState(request.state);
        const file = validateParentRosterFile(JSON.parse(await readFile(dataFile, "utf8")));
        if (file.records.length >= maximumParentRosters) {
          throw new ParentRosterError(507, "De server kan momenteel geen extra ouderroosters bewaren.");
        }
        const nameKey = parentNameKey(parentName);
        const sameName = file.records.filter((record) => record.nameKey === nameKey);
        if (sameName.length >= 25) {
          throw new ParentRosterError(409, "Voor deze voornaam zijn te veel serverback-ups aanwezig. Kies een herkenbare toevoeging bij de voornaam.");
        }
        for (const record of sameName) {
          if (await tryDecryptParentRoster(record, password)) {
            const encrypted = await encryptParentRoster(state, password, nameKey);
            const updatedAt = new Date().toISOString();
            Object.assign(record, { updatedAt, ...encrypted });
            await saveFile(file);
            return { createdAt: record.createdAt, updatedAt, updated: true };
          }
        }
        const encrypted = await encryptParentRoster(state, password, nameKey);
        const createdAt = new Date().toISOString();
        file.records.push({ id: randomUUID(), nameKey, createdAt, updatedAt: createdAt, ...encrypted });
        await saveFile(file);
        return { createdAt, updatedAt: createdAt, updated: false };
      });
    },
    load(input) {
      return exclusive(async () => {
        const request = object(input, "Vul de voornaam en het wachtwoord in.");
        const parentName = normalizeParentName(request.parentName);
        const password = validateParentPassword(request.password);
        const nameKey = parentNameKey(parentName);
        const file = validateParentRosterFile(JSON.parse(await readFile(dataFile, "utf8")));
        const sameName = file.records.filter((record) => record.nameKey === nameKey);
        for (const record of sameName) {
          const state = await tryDecryptParentRoster(record, password);
          if (state) return state;
        }
        if (!sameName.length) {
          const dummyKey = await deriveParentRosterKey(password, Buffer.alloc(16));
          dummyKey.fill(0);
        }
        throw new ParentRosterError(401, "Geen serverback-up gevonden voor deze combinatie van voornaam en wachtwoord.");
      });
    },
  };
}

export function validateSchoolExceptionFile(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.exceptions)) {
    throw new Error("Ongeldig JSON-bestand: 'exceptions' moet een lijst zijn.");
  }
  if (input.exceptions.length > 500) throw new Error("Maximaal 500 schoolbrede uitzonderingen toegestaan.");

  const byDate = new Map();
  for (const item of input.exceptions) {
    if (!item || typeof item !== "object" || !validDate(item.date)) {
      throw new Error("Iedere uitzondering moet een geldige datum in YYYY-MM-DD-formaat hebben.");
    }
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";
    if (!reason || reason.length > 200) {
      throw new Error("Iedere uitzondering moet een reden van maximaal 200 tekens hebben.");
    }
    const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `school-${item.date}`;
    byDate.set(item.date, { id, date: item.date, reason });
  }

  return {
    version: 1,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null,
    exceptions: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function readBody(request, maximumSize = 100_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumSize) throw new ParentRosterError(413, "Het JSON-bestand is te groot.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readForm(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 10_000) throw new Error("Formulier is te groot.");
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function consumeRateLimit(entries, key, limit, windowMilliseconds) {
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.expiresAt <= now) {
    entries.set(key, { count: 1, expiresAt: now + windowMilliseconds });
  } else {
    if (current.count >= limit) {
      throw new ParentRosterError(429, "Te veel pogingen. Wacht even en probeer het later opnieuw.");
    }
    current.count += 1;
  }
  if (entries.size > 10_000) {
    for (const [entryKey, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(entryKey);
    }
  }
}

export function passwordMatches(received, expected) {
  if (!expected || typeof received !== "string") return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function normalizeFeedbackWhatsappNumber(value) {
  const number = typeof value === "string" ? value.trim() : "";
  return /^316\d{8}$/.test(number) ? number : "";
}

function accessDigest(password, purpose) {
  return createHash("sha256").update(`poetsrooster:${purpose}:${password}`).digest("base64url");
}

export function createAccessLinkToken(password) {
  return accessDigest(password, "link");
}

export function createAccessCookieValue(password) {
  return accessDigest(password, "cookie");
}

function cookieValue(request, name) {
  const cookies = String(request.headers.cookie ?? "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0 || cookie.slice(0, separator).trim() !== name) continue;
    return cookie.slice(separator + 1).trim();
  }
  return undefined;
}

function requestHasAccess(request, accessPassword) {
  if (!accessPassword) return false;
  return passwordMatches(cookieValue(request, "poetsrooster_access"), createAccessCookieValue(accessPassword));
}

function accessCookie(request, accessPassword) {
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const secure = forwardedProtocol === "https" || Boolean(request.socket.encrypted);
  return [
    `poetsrooster_access=${createAccessCookieValue(accessPassword)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=2592000",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

async function ensureDataFile(dataFile) {
  await mkdir(resolve(dataFile, ".."), { recursive: true });
  try {
    await access(dataFile);
  } catch {
    await writeFile(dataFile, JSON.stringify({ version: 1, updatedAt: null, exceptions: [] }, null, 2));
  }
}

export async function createSchoolExceptionStore(dataDirectory = defaultDataDirectory) {
  const dataFile = join(dataDirectory, "school-uitzonderingen.json");
  await ensureDataFile(dataFile);
  return {
    async load() {
      return validateSchoolExceptionFile(JSON.parse(await readFile(dataFile, "utf8")));
    },
    async save(input) {
      const validated = validateSchoolExceptionFile(input);
      const saved = { ...validated, updatedAt: new Date().toISOString() };
      const temporaryFile = `${dataFile}.tmp`;
      await writeFile(temporaryFile, JSON.stringify(saved, null, 2));
      await rename(temporaryFile, dataFile);
      return saved;
    },
  };
}

async function serveStatic(request, response, distDirectory) {
  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = requestPath === "/" ? "index.html" : normalize(requestPath).replace(/^[/\\]+/, "");
  let file = resolve(distDirectory, relative);
  if (!file.startsWith(resolve(distDirectory))) {
    response.writeHead(403).end("Verboden");
    return;
  }
  try {
    if (!(await stat(file)).isFile()) throw new Error("not a file");
  } catch {
    file = join(distDirectory, "index.html");
  }
  try {
    const details = await stat(file);
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(file)] ?? "application/octet-stream",
      "Content-Length": details.size,
      "Cache-Control": extname(file) === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404).end("Niet gevonden");
  }
}

export async function createAppServer(options = {}) {
  const dataDirectory = options.dataDirectory ?? process.env.DATA_DIR ?? defaultDataDirectory;
  const distDirectory = options.distDirectory ?? defaultDistDirectory;
  const adminPassword = options.adminPassword ?? process.env.SCHOOL_ADMIN_PASSWORD ?? "";
  const accessPassword = options.accessPassword ?? process.env.ACCESS_PASSWORD ?? "";
  const feedbackWhatsappNumber = normalizeFeedbackWhatsappNumber(
    options.feedbackWhatsappNumber ?? process.env.FEEDBACK_WHATSAPP_NUMBER ?? "",
  );
  const store = await createSchoolExceptionStore(dataDirectory);
  const parentRosterStore = await createParentRosterStore(dataDirectory);
  const parentRosterLoadAttempts = new Map();
  const parentRosterSaveAttempts = new Map();

  return createHttpServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/api/health" && request.method === "GET") {
        json(response, 200, { ok: true });
        return;
      }
      if (pathname.startsWith("/toegang/") && request.method === "GET") {
        const token = decodeURIComponent(pathname.slice("/toegang/".length));
        if (accessPassword && passwordMatches(token, createAccessLinkToken(accessPassword))) {
          response.writeHead(302, {
            "Cache-Control": "no-store",
            "Location": "/",
            "Referrer-Policy": "no-referrer",
            "Set-Cookie": accessCookie(request, accessPassword),
          });
          response.end();
          return;
        }
        html(response, accessPassword ? 401 : 503, loginPage("De toegangslink is niet geldig.", Boolean(accessPassword)));
        return;
      }
      if (pathname === "/api/access/login" && request.method === "POST") {
        if (!accessPassword) {
          html(response, 503, loginPage("", false));
          return;
        }
        const password = (await readForm(request)).get("password");
        if (!passwordMatches(password, accessPassword)) {
          html(response, 401, loginPage("Het wachtwoord is niet juist."));
          return;
        }
        response.writeHead(303, {
          "Cache-Control": "no-store",
          "Location": "/",
          "Set-Cookie": accessCookie(request, accessPassword),
        });
        response.end();
        return;
      }
      if (!requestHasAccess(request, accessPassword)) {
        if (pathname.startsWith("/api/")) {
          json(response, 401, { error: accessPassword ? "Log eerst in." : "Toegang is nog niet geconfigureerd." });
        } else {
          html(response, accessPassword ? 200 : 503, loginPage("", Boolean(accessPassword)));
        }
        return;
      }
      if (pathname === "/api/config" && request.method === "GET") {
        json(response, 200, { feedbackWhatsappNumber });
        return;
      }
      if (pathname === "/api/parent-rosters" && request.method === "POST") {
        consumeRateLimit(parentRosterSaveAttempts, request.socket.remoteAddress ?? "onbekend", 20, 60 * 60 * 1000);
        const saved = await parentRosterStore.create(await readBody(request, 2_500_000));
        json(response, saved.updated ? 200 : 201, saved);
        return;
      }
      if (pathname === "/api/parent-rosters/load" && request.method === "POST") {
        consumeRateLimit(parentRosterLoadAttempts, request.socket.remoteAddress ?? "onbekend", 30, 10 * 60 * 1000);
        json(response, 200, { state: await parentRosterStore.load(await readBody(request, 20_000)) });
        return;
      }
      if (pathname === "/api/school-exceptions" && request.method === "GET") {
        json(response, 200, await store.load());
        return;
      }
      if (pathname === "/api/school-exceptions/unlock" && request.method === "POST") {
        if (!adminPassword) {
          json(response, 503, { error: "Schoolbeheer is nog niet geconfigureerd op de server." });
          return;
        }
        if (!passwordMatches(request.headers["x-school-admin-password"], adminPassword)) {
          json(response, 401, { error: "Onjuist beheerwachtwoord." });
          return;
        }
        json(response, 200, { ok: true });
        return;
      }
      if (pathname === "/api/school-exceptions" && request.method === "PUT") {
        if (!adminPassword) {
          json(response, 503, { error: "Schoolbeheer is nog niet geconfigureerd op de server." });
          return;
        }
        if (!passwordMatches(request.headers["x-school-admin-password"], adminPassword)) {
          json(response, 401, { error: "Onjuist beheerwachtwoord." });
          return;
        }
        json(response, 200, await store.save(await readBody(request)));
        return;
      }
      if (pathname.startsWith("/api/")) {
        json(response, 404, { error: "API-route niet gevonden." });
        return;
      }
      await serveStatic(request, response, distDirectory);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Onbekende serverfout.";
      const status = error instanceof ParentRosterError ? error.status : 400;
      json(response, status, { error: message });
    }
  });
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  const port = Number(process.env.PORT || 3000);
  const accessPassword = process.env.ACCESS_PASSWORD ?? "";
  const rawFeedbackWhatsappNumber = process.env.FEEDBACK_WHATSAPP_NUMBER ?? "";
  const server = await createAppServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Poetsrooster luistert op poort ${port}`);
    if (accessPassword) {
      console.log(`Unieke toegangsroute: /toegang/${createAccessLinkToken(accessPassword)}`);
    } else {
      console.warn("ACCESS_PASSWORD ontbreekt; de app blijft gesloten totdat dit is ingesteld.");
    }
    if (rawFeedbackWhatsappNumber && !normalizeFeedbackWhatsappNumber(rawFeedbackWhatsappNumber)) {
      console.warn("FEEDBACK_WHATSAPP_NUMBER heeft niet het verwachte formaat 31612345678; de feedbackknop is verborgen.");
    }
  });
}
