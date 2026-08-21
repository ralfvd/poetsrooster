import { describe, expect, it } from "vitest";
import type { ScheduleSettings } from "../types";
import { generateSchedule, groupScheduleByWeek } from "./schedule";

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
