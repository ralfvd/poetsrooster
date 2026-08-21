import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSchoolExceptionStore,
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
