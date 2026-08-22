import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSchoolExceptionStore,
  createAccessLinkToken,
  createAppServer,
  passwordMatches,
  validateSchoolExceptionFile,
} from "./server.mjs";

const temporaryDirectories = [];
afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("schoolbrede uitzonderingen API", () => {
  it("valideert, dedupliceert en sorteert uitzonderingen", () => {
    const result = validateSchoolExceptionFile({ exceptions: [
      { date: "2027-01-02", reason: "Eerste reden" },
      { date: "2026-12-24", reason: "Kerstvakantie" },
      { date: "2027-01-02", reason: "Definitieve reden" },
    ] });
    expect(result.exceptions).toEqual([
      { id: "school-2026-12-24", date: "2026-12-24", reason: "Kerstvakantie" },
      { id: "school-2027-01-02", date: "2027-01-02", reason: "Definitieve reden" },
    ]);
  });

  it("bewaart centraal in een JSON-bestand en leest dit opnieuw", async () => {
    const directory = await mkdtemp(join(tmpdir(), "poetsrooster-api-"));
    temporaryDirectories.push(directory);
    const store = await createSchoolExceptionStore(directory);
    const saved = await store.save({
      exceptions: [{ date: "2026-10-14", reason: "herfstvakantie" }],
    });
    expect(saved.updatedAt).toBeTruthy();
    expect((await store.load()).exceptions).toEqual([
      { id: "school-2026-10-14", date: "2026-10-14", reason: "herfstvakantie" },
    ]);
    const stored = JSON.parse(await readFile(join(directory, "school-uitzonderingen.json"), "utf8"));
    expect(stored.updatedAt).toBeTruthy();
  });

  it("vergelijkt het beheerwachtwoord veilig", () => {
    expect(passwordMatches("test-geheim", "test-geheim")).toBe(true);
    expect(passwordMatches("verkeerd", "test-geheim")).toBe(false);
    expect(passwordMatches(undefined, "test-geheim")).toBe(false);
  });
});

describe("toegangsbeveiliging", () => {
  it("toont op de basislink een login en accepteert wachtwoord en unieke link", async () => {
    const directory = await mkdtemp(join(tmpdir(), "poetsrooster-access-"));
    temporaryDirectories.push(directory);
    const distDirectory = join(directory, "dist");
    await mkdir(distDirectory, { recursive: true });
    await writeFile(join(distDirectory, "index.html"), "<h1>Beveiligde app</h1>");
    const server = await createAppServer({
      dataDirectory: join(directory, "data"),
      distDirectory,
      accessPassword: "toegang-geheim",
      adminPassword: "beheer-geheim",
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Testserver heeft geen poort.");
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const loginPage = await fetch(baseUrl);
      expect(loginPage.status).toBe(200);
      const loginHtml = await loginPage.text();
      expect(loginHtml).toContain("Eerlijk verdeeld, slim geregeld");
      expect(loginHtml).toContain("Vul het toegangswachtwoord in");

      const blockedApi = await fetch(`${baseUrl}/api/school-exceptions`);
      expect(blockedApi.status).toBe(401);

      const wrongLogin = await fetch(`${baseUrl}/api/access/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: "verkeerd" }),
      });
      expect(wrongLogin.status).toBe(401);

      const correctLogin = await fetch(`${baseUrl}/api/access/login`, {
        method: "POST",
        redirect: "manual",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: "toegang-geheim" }),
      });
      expect(correctLogin.status).toBe(303);
      const cookie = correctLogin.headers.get("set-cookie");
      expect(cookie).toContain("poetsrooster_access=");
      expect(cookie).toContain("HttpOnly");

      const openedApp = await fetch(baseUrl, { headers: { Cookie: cookie.split(";")[0] } });
      expect(await openedApp.text()).toContain("Beveiligde app");

      const wrongAdminUnlock = await fetch(`${baseUrl}/api/school-exceptions/unlock`, {
        method: "POST",
        headers: {
          Cookie: cookie.split(";")[0],
          "X-School-Admin-Password": "verkeerd",
        },
      });
      expect(wrongAdminUnlock.status).toBe(401);

      const correctAdminUnlock = await fetch(`${baseUrl}/api/school-exceptions/unlock`, {
        method: "POST",
        headers: {
          Cookie: cookie.split(";")[0],
          "X-School-Admin-Password": "beheer-geheim",
        },
      });
      expect(correctAdminUnlock.status).toBe(200);

      const uniqueLink = await fetch(`${baseUrl}/toegang/${createAccessLinkToken("toegang-geheim")}`, {
        redirect: "manual",
      });
      expect(uniqueLink.status).toBe(302);
      expect(uniqueLink.headers.get("location")).toBe("/");
      expect(uniqueLink.headers.get("set-cookie")).toContain("poetsrooster_access=");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("blijft gesloten wanneer ACCESS_PASSWORD ontbreekt", async () => {
    const directory = await mkdtemp(join(tmpdir(), "poetsrooster-no-access-"));
    temporaryDirectories.push(directory);
    const server = await createAppServer({ dataDirectory: directory, accessPassword: "" });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Testserver heeft geen poort.");
      const response = await fetch(`http://127.0.0.1:${address.port}`);
      expect(response.status).toBe(503);
      expect(await response.text()).toContain("ACCESS_PASSWORD");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
