import { describe, expect, it } from "vitest";
import type { PersistedState } from "../types";
import { buildRosterBackupFilename, createRosterBackup, normalizeRosterBackup } from "./rosterBackup";

const state: PersistedState = {
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
  excludedDates: [{ id: "vrij", date: "2026-10-14", reason: "klasuitje" }],
  schedule: [{
    date: "2026-08-26",
    weekday: 3,
    excluded: false,
    assignments: [{ studentId: "anna", locked: true, source: "manual" }],
  }],
};

describe("poetsroosterback-up", () => {
  it("bewaart en herstelt alle bewerkbare roostergegevens", () => {
    const restored = normalizeRosterBackup(JSON.parse(JSON.stringify(createRosterBackup(state))));
    expect(restored.state).toEqual(state);
    expect(restored.format).toBe("poetsrooster-backup");
  });

  it("weigert een schoolkalenderbestand als roosterback-up", () => {
    expect(() => normalizeRosterBackup({ version: 1, exceptions: [] }))
      .toThrow("geen ondersteunde poetsroosterback-up");
  });

  it("weigert toewijzingen aan een onbekende leerling", () => {
    const backup = createRosterBackup(state);
    backup.state.schedule[0].assignments[0].studentId = "onbekend";
    expect(() => normalizeRosterBackup(backup)).toThrow("onbekende leerling");
  });

  it("zet klasnaam en datum in de bestandsnaam", () => {
    expect(buildRosterBackupFilename("Groep 7B", "2026-08-21T19:30:00.000Z"))
      .toBe("groep-7b-poetsrooster-back-up-2026-08-21.json");
  });
});
