import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const currentDirectory = fileURLToPath(new URL(".", import.meta.url));
const defaultDataDirectory = join(currentDirectory, "data");
const defaultDistDirectory = join(currentDirectory, "dist");

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

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100_000) throw new Error("Het JSON-bestand is te groot.");
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
      json(response, 400, { error: message });
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
