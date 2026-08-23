import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSchoolExceptionStore,
  createParentRosterStore,
  createAccessLinkToken,
  createAppServer,
  normalizeFeedbackWhatsappNumber,
  passwordMatches,
  validateSchoolExceptionFile,
} from "./server.mjs";

const parentRosterState = {
  version: 1,
  settings: {
    className: "Groep 7B",
    startDate: "2026-08-24",
    endDate: "2027-07-19",
    cleaningWeekdays: [3, 5],
    studentsPerCleaningDay: 1,
  },
  students: [{
    id: "anna",
    name: "Anna",
    previousYearCount: 2,
    manualOnly: false,
    availableWeekdays: [3, 5],
  }],
  excludedDates: [{ id: "reis", date: "2026-10-14", reason: "schoolreisje" }],
  schedule: [{
    date: "2026-08-26",
    weekday: 3,
    excluded: false,
    assignments: [{ studentId: "anna", locked: true, source: "manual" }],
  }],
};

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

  it("accepteert alleen een WhatsApp-nummer in het afgesproken formaat", () => {
    expect(normalizeFeedbackWhatsappNumber("31612345678")).toBe("31612345678");
    expect(normalizeFeedbackWhatsappNumber("+31612345678")).toBe("");
    expect(normalizeFeedbackWhatsappNumber("316 12345678")).toBe("");
  });
});

describe("versleutelde ouderroosters", () => {
  it("bewaart geen leesbare roostergegevens of wachtwoorden en kan opnieuw laden", async () => {
    const directory = await mkdtemp(join(tmpdir(), "poetsrooster-ouders-"));
    temporaryDirectories.push(directory);
    const store = await createParentRosterStore(directory);
    await expect(store.create({
      parentName: "Ralf",
      password: "kort123",
      passwordConfirmation: "kort123",
      state: parentRosterState,
    })).rejects.toMatchObject({ status: 400 });
    await store.create({
      parentName: "Ralf",
      password: "acht1234",
      passwordConfirmation: "acht1234",
      state: parentRosterState,
    });

    const rawFile = await readFile(join(directory, "ouderroosters.json"), "utf8");
    expect(rawFile).not.toContain("Ralf");
    expect(rawFile).not.toContain("acht1234");
    expect(rawFile).not.toContain("Anna");
    expect(rawFile).not.toContain("Groep 7B");

    const restartedStore = await createParentRosterStore(directory);
    await expect(restartedStore.load({ parentName: "ralf", password: "acht1234" }))
      .resolves.toEqual(parentRosterState);
    await expect(restartedStore.load({ parentName: "Ralf", password: "verkeerd-wachtwoord" }))
      .rejects.toMatchObject({ status: 401 });
  });

  it("werkt een bestaande combinatie bij zonder dubbel record en staat een ander wachtwoord apart toe", async () => {
    const directory = await mkdtemp(join(tmpdir(), "poetsrooster-ouders-uniek-"));
    temporaryDirectories.push(directory);
    const store = await createParentRosterStore(directory);
    await store.create({
      parentName: "Sam",
      password: "eerste-wachtwoord",
      passwordConfirmation: "eerste-wachtwoord",
      state: parentRosterState,
    });
    const updatedState = {
      ...parentRosterState,
      students: [
        ...parentRosterState.students,
        { id: "bram", name: "Bram", previousYearCount: 0, manualOnly: false, availableWeekdays: [3, 5] },
      ],
    };
    await expect(store.create({
      parentName: "sam",
      password: "eerste-wachtwoord",
      passwordConfirmation: "eerste-wachtwoord",
      state: updatedState,
    })).resolves.toMatchObject({ updated: true });
    await expect(store.load({ parentName: "Sam", password: "eerste-wachtwoord" }))
      .resolves.toEqual(updatedState);
    expect(JSON.parse(await readFile(join(directory, "ouderroosters.json"), "utf8")).records).toHaveLength(1);
    await expect(store.create({
      parentName: "Sam",
      password: "tweede-wachtwoord",
      passwordConfirmation: "tweede-wachtwoord",
      state: { ...parentRosterState, settings: { ...parentRosterState.settings, className: "Groep 8A" } },
    })).resolves.toMatchObject({ updated: false });
    await expect(store.load({ parentName: "Sam", password: "tweede-wachtwoord" }))
      .resolves.toMatchObject({ settings: { className: "Groep 8A" } });
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
      feedbackWhatsappNumber: "31612345678",
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
      const blockedConfig = await fetch(`${baseUrl}/api/config`);
      expect(blockedConfig.status).toBe(401);
      const blockedParentRoster = await fetch(`${baseUrl}/api/parent-rosters/load`, { method: "POST" });
      expect(blockedParentRoster.status).toBe(401);

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

      const appConfig = await fetch(`${baseUrl}/api/config`, { headers: { Cookie: cookie.split(";")[0] } });
      expect(appConfig.status).toBe(200);
      expect(await appConfig.json()).toEqual({ feedbackWhatsappNumber: "31612345678" });

      const savedParentRoster = await fetch(`${baseUrl}/api/parent-rosters`, {
        method: "POST",
        headers: { Cookie: cookie.split(";")[0], "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: "Ralf",
          password: "veilig-wachtwoord",
          passwordConfirmation: "veilig-wachtwoord",
          state: parentRosterState,
        }),
      });
      expect(savedParentRoster.status).toBe(201);

      const updatedParentRosterState = {
        ...parentRosterState,
        students: [
          ...parentRosterState.students,
          { id: "bram", name: "Bram", previousYearCount: 0, manualOnly: false, availableWeekdays: [3, 5] },
        ],
      };
      const updatedParentRoster = await fetch(`${baseUrl}/api/parent-rosters`, {
        method: "POST",
        headers: { Cookie: cookie.split(";")[0], "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: "ralf",
          password: "veilig-wachtwoord",
          passwordConfirmation: "veilig-wachtwoord",
          state: updatedParentRosterState,
        }),
      });
      expect(updatedParentRoster.status).toBe(200);
      expect((await updatedParentRoster.json()).updated).toBe(true);

      const loadedParentRoster = await fetch(`${baseUrl}/api/parent-rosters/load`, {
        method: "POST",
        headers: { Cookie: cookie.split(";")[0], "Content-Type": "application/json" },
        body: JSON.stringify({ parentName: "Ralf", password: "veilig-wachtwoord" }),
      });
      expect(loadedParentRoster.status).toBe(200);
      expect((await loadedParentRoster.json()).state).toEqual(updatedParentRosterState);

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
