import { describe, expect, it } from "vitest";
import type { Student } from "../types";
import { needsAvailabilityWarning } from "./students";

const student: Student = {
  id: "anna",
  name: "Anna",
  previousYearCount: 0,
  manualOnly: false,
  availableWeekdays: [3],
};

describe("needsAvailabilityWarning", () => {
  it("waarschuwt voor een niet-beschikbare dag bij een gewone leerling", () => {
    expect(needsAvailabilityWarning(student, 5)).toBe(true);
  });

  it("waarschuwt niet bij een leerling die handmatig wordt ingepland", () => {
    expect(needsAvailabilityWarning({ ...student, manualOnly: true, availableWeekdays: [] }, 5)).toBe(false);
  });
});
