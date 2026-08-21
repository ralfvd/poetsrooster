import { describe, expect, it } from "vitest";
import type { ScheduleSettings, Student } from "../types";
import { generateSchedule } from "../utils/schedule";
import { buildScheduleTitle, buildScheduleTsv, createSchedulePdf } from "./export";

const settings: ScheduleSettings = {
  className: "Groep 7B",
  startDate: "2026-08-24",
  endDate: "2027-07-19",
  cleaningWeekdays: [3, 5],
  studentsPerCleaningDay: 1,
};

const students: Student[] = [
  { id: "anna", name: "Anna", previousYearCount: 2, manualOnly: false, availableWeekdays: [3, 5] },
  { id: "bram", name: "Bram", previousYearCount: 3, manualOnly: false, availableWeekdays: [3, 5] },
];

function filledSchedule() {
  return generateSchedule(
    settings,
    [{ id: "holiday", date: "2026-10-14", reason: "herfstvakantie" }],
  ).map((day, index) => ({
    ...day,
    assignments: day.excluded
      ? []
      : [{ studentId: students[index % students.length].id, locked: false, source: "optimizer" as const }],
  }));
}

describe("schedule export", () => {
  it("zet Poetsrooster voor de ingevulde klasnaam", () => {
    expect(buildScheduleTitle("Groep 7B")).toBe("Poetsrooster Groep 7B");
    expect(buildScheduleTitle("  Groep 8A  ")).toBe("Poetsrooster Groep 8A");
    expect(buildScheduleTitle("")).toBe("Poetsrooster");
  });

  it("maakt plakbare tabgescheiden tekst met uitzonderingen", () => {
    const text = buildScheduleTsv(filledSchedule(), students, settings.cleaningWeekdays);
    expect(text.startsWith("Week van\tWoensdag\tVrijdag\tOpmerkingen")).toBe(true);
    expect(text).toContain("Woensdag: herfstvakantie");
    expect(text).toContain("Anna");
  });

  it("kort een gelijke reden voor meerdere uitgesloten dagen samen", () => {
    const schedule = generateSchedule(settings, [
      { id: "holiday-1", date: "2026-10-14", reason: "herfstvakantie" },
      { id: "holiday-2", date: "2026-10-16", reason: "herfstvakantie" },
    ]);
    const text = buildScheduleTsv(schedule, students, settings.cleaningWeekdays);
    expect(text).toContain("--\t--\therfstvakantie");
  });

  it("maakt het volledige schooljaar als één A4 portrait PDF", async () => {
    const pdf = await createSchedulePdf(settings, filledSchedule(), students);
    expect(pdf.getNumberOfPages()).toBe(1);
    expect(pdf.internal.pageSize.getWidth()).toBeLessThan(pdf.internal.pageSize.getHeight());
    expect(pdf.output("arraybuffer").byteLength).toBeGreaterThan(2_000);
  });
});
