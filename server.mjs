import { timingSafeEqual } from "node:crypto";
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

export function passwordMatches(received, expected) {
  if (!expected || typeof received !== "string") return false;
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
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
  const store = await createSchoolExceptionStore(dataDirectory);

  return createHttpServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname === "/api/health" && request.method === "GET") {
        json(response, 200, { ok: true });
        return;
      }
      if (pathname === "/api/school-exceptions" && request.method === "GET") {
        json(response, 200, await store.load());
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
  const server = await createAppServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Poetsrooster luistert op poort ${port}`);
  });
}
