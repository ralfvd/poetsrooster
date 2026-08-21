import { describe, expect, it } from "vitest";
import type { Student } from "../types";
import { addMissingStudentFields } from "./ClassEditor";

const existing: Student = {
  id: "anna",
  name: "Anna",
  previousYearCount: 2,
  manualOnly: false,
  availableWeekdays: [3],
};

describe("addMissingStudentFields", () => {
  it("maakt vanuit een lege klas 25 invulvelden", () => {
    let nextId = 1;
    const result = addMissingStudentFields([], 25, [3, 5], () => `leerling-${nextId++}`);

    expect(result).toHaveLength(25);
    expect(result.every((student) => student.name === "")).toBe(true);
    expect(new Set(result.map((student) => student.id)).size).toBe(25);
  });

  it("vult tot het gewenste aantal aan en behoudt bestaande leerlingen", () => {
    let nextId = 1;
    const result = addMissingStudentFields([existing], 3, [3, 5], () => `nieuw-${nextId++}`);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(existing);
    expect(result.slice(1)).toEqual([
      {
        id: "nieuw-1",
        name: "",
        previousYearCount: 0,
        manualOnly: false,
        availableWeekdays: [3, 5],
      },
      {
        id: "nieuw-2",
        name: "",
        previousYearCount: 0,
        manualOnly: false,
        availableWeekdays: [3, 5],
      },
    ]);
  });

  it("verwijdert niets wanneer een lager aantal wordt ingevuld", () => {
    const students = [existing];
    expect(addMissingStudentFields(students, 0, [3, 5])).toBe(students);
    expect(addMissingStudentFields(students, 1, [3, 5])).toBe(students);
  });
});
