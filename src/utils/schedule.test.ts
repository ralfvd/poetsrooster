import { describe, expect, it } from "vitest";
import type { ScheduleDay, ScheduleSettings, Student } from "../types";
import { calculateStatistics, generateSchedule, groupScheduleByWeek } from "./schedule";

describe("generateSchedule", () => {
  const settings: ScheduleSettings = {
    className: "Groep 7B",
    startDate: "2026-10-12",
    endDate: "2026-10-18",
    cleaningWeekdays: [3, 5],
    studentsPerCleaningDay: 1,
  };

  it("houdt een uitgesloten poetsdag in dezelfde weekrij zichtbaar", () => {
    const schedule = generateSchedule(settings, [
      { id: "holiday", date: "2026-10-14", reason: "herfstvakantie" },
      { id: "holiday-2", date: "2026-10-16", reason: "herfstvakantie" },
    ]);
    expect(schedule).toHaveLength(2);
    expect(schedule.every((day) => day.excluded && day.assignments.length === 0)).toBe(true);
    const groups = groupScheduleByWeek(schedule);
    expect(groups).toHaveLength(1);
    expect(groups[0].days.get(3)?.exclusionReason).toBe("herfstvakantie");
    expect(groups[0].days.get(5)?.exclusionReason).toBe("herfstvakantie");
  });
});

describe("calculateStatistics", () => {
  const student: Student = {
    id: "anna",
    name: "Anna",
    previousYearCount: 2,
    manualOnly: false,
    availableWeekdays: [3, 5],
  };

  const assignedDay = (date: string): ScheduleDay => ({
    date,
    weekday: 3,
    excluded: false,
    assignments: [{ studentId: student.id, locked: false, source: "optimizer" }],
  });

  it("berekent minimum, gemiddelde en maximum tussen opeenvolgende beurten in weken", () => {
    const [statistic] = calculateStatistics([student], [
      assignedDay("2026-09-02"),
      assignedDay("2026-09-16"),
      assignedDay("2026-10-14"),
    ]);
    expect(statistic.minimumIntervalWeeks).toBe(2);
    expect(statistic.averageIntervalWeeks).toBe(3);
    expect(statistic.maximumIntervalWeeks).toBe(4);
  });

  it("toont geen periode wanneer er minder dan twee beurten zijn", () => {
    const [statistic] = calculateStatistics([student], [assignedDay("2026-09-02")]);
    expect(statistic.minimumIntervalWeeks).toBeNull();
    expect(statistic.averageIntervalWeeks).toBeNull();
    expect(statistic.maximumIntervalWeeks).toBeNull();
  });
});
