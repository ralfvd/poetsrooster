import { describe, expect, it } from "vitest";
import type { Assignment, ScheduleDay, Student, Weekday } from "../types";
import { effectivePreviousYearCounts, optimizeSchedule } from "./optimizer";

const assignment = (studentId: string | null = null, locked = false): Assignment => ({
  studentId,
  locked,
  source: locked ? "manual" : null,
});

function students(count: number, availableWeekdays: Weekday[] = [3, 5]): Student[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `student-${index + 1}`,
    name: `Kind ${index + 1}`,
    previousYearCount: 3,
    manualOnly: false,
    availableWeekdays,
  }));
}

function days(count: number, capacity = 1, weekdays: Weekday[] = [3, 5]): ScheduleDay[] {
  return Array.from({ length: count }, (_, index) => {
    const weekday = weekdays[index % weekdays.length];
    const date = new Date(Date.UTC(2026, 0, 1 + index * 2)).toISOString().slice(0, 10);
    return { date, weekday, excluded: false, assignments: Array.from({ length: capacity }, () => assignment()) };
  });
}

function weeklyDays(weeks: number): ScheduleDay[] {
  return Array.from({ length: weeks }, (_, week) => {
    const wednesday = new Date(Date.UTC(2026, 0, 7 + week * 7));
    const friday = new Date(Date.UTC(2026, 0, 9 + week * 7));
    return [
      { date: wednesday.toISOString().slice(0, 10), weekday: 3 as const, excluded: false, assignments: [assignment()] },
      { date: friday.toISOString().slice(0, 10), weekday: 5 as const, excluded: false, assignments: [assignment()] },
    ];
  }).flat();
}

function counts(schedule: ScheduleDay[], roster: Student[]): Map<string, number> {
  const result = new Map(roster.map((student) => [student.id, 0]));
  schedule.forEach((day) => day.assignments.forEach((item) => {
    if (item.studentId) result.set(item.studentId, (result.get(item.studentId) ?? 0) + 1);
  }));
  return result;
}

describe("optimizeSchedule", () => {
  it("verdeelt 60 vrije slots exact over 30 leerlingen", () => {
    const roster = students(30);
    const result = optimizeSchedule(roster, days(60));
    expect([...counts(result.schedule, roster).values()]).toEqual(Array(30).fill(2));
    expect(result.warnings).toEqual([]);
  });

  it("geeft restslots op basis van de historische telling", () => {
    const roster = students(31).map((student, index) => ({
      ...student,
      previousYearCount: index < 3 ? 1 : 4,
    }));
    const result = optimizeSchedule(roster, days(96));
    const totals = counts(result.schedule, roster);
    expect([totals.get("student-1"), totals.get("student-2"), totals.get("student-3")]).toEqual([4, 4, 4]);
    expect([...totals.values()].filter((count) => count === 4)).toHaveLength(3);
    expect([...totals.values()].filter((count) => count === 3)).toHaveLength(28);
  });

  it("behandelt nul als het gemiddelde van bekende eerdere tellingen", () => {
    const roster = students(4).map((student, index) => ({
      ...student,
      previousYearCount: [0, 2, 3, 4][index],
    }));
    const effective = effectivePreviousYearCounts(roster);
    expect(effective.get("student-1")).toBe(3);

    const result = optimizeSchedule(roster, days(9));
    const totals = counts(result.schedule, roster);
    expect(totals.get("student-1")).toBe(2);
    expect(totals.get("student-2")).toBe(3);
  });

  it("houdt alle historische tellingen gelijk wanneer iedereen op nul staat", () => {
    const roster = students(4).map((student) => ({ ...student, previousYearCount: 0 }));
    expect([...effectivePreviousYearCounts(roster).values()]).toEqual([0, 0, 0, 0]);
  });

  it("plant schaarse vrijdagplaatsen zonder availability te schenden", () => {
    const fridayOnly = students(10, [5]);
    const flexible = students(20, [3, 5]).map((student, index) => ({ ...student, id: `flex-${index}` }));
    const roster = [...fridayOnly, ...flexible];
    const result = optimizeSchedule(roster, days(60, 1, [3, 5]));
    expect(result.schedule.every((day) => {
      const selected = roster.find((student) => student.id === day.assignments[0].studentId);
      return selected?.availableWeekdays.includes(day.weekday);
    })).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it("varieert de verdeling over de weken zonder de eindtelling oneerlijk te maken", () => {
    const roster = students(8);
    const first = optimizeSchedule(roster, weeklyDays(24), 101);
    const second = optimizeSchedule(roster, weeklyDays(24), 202);
    const firstSequence = first.schedule.map((day) => day.assignments[0].studentId);
    const secondSequence = second.schedule.map((day) => day.assignments[0].studentId);
    expect(firstSequence).not.toEqual(secondSequence);
    for (const result of [first, second]) {
      const values = [...counts(result.schedule, roster).values()];
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    }
  });

  it("houdt bij flexibele beschikbaarheid zo veel mogelijk één vaste weekdag aan", () => {
    const roster = students(8);
    const result = optimizeSchedule(roster, weeklyDays(32), 303);
    const weekdaysByStudent = new Map(roster.map((student) => [student.id, new Set<Weekday>()]));
    result.schedule.forEach((day) => {
      const studentId = day.assignments[0].studentId;
      if (studentId) weekdaysByStudent.get(studentId)?.add(day.weekday);
    });
    expect([...weekdaysByStudent.values()].every((assignedWeekdays) => assignedWeekdays.size === 1)).toBe(true);
  });

  it("laat handmatig vastgezette toewijzingen exact staan", () => {
    const roster = students(8);
    const schedule = days(20);
    const locked = [0, 3, 6, 9, 12];
    locked.forEach((dayIndex, index) => {
      schedule[dayIndex].assignments[0] = assignment(roster[index].id, true);
    });
    const result = optimizeSchedule(roster, schedule);
    locked.forEach((dayIndex, index) => {
      expect(result.schedule[dayIndex].assignments[0]).toEqual(assignment(roster[index].id, true));
    });
  });

  it("laat uitgesloten dagen zichtbaar en leeg", () => {
    const roster = students(5);
    const schedule = days(4);
    schedule[1] = {
      ...schedule[1],
      excluded: true,
      exclusionReason: "herfstvakantie",
      assignments: [assignment(roster[0].id, false)],
    };
    const result = optimizeSchedule(roster, schedule);
    expect(result.schedule).toHaveLength(4);
    expect(result.schedule[1]).toMatchObject({ excluded: true, exclusionReason: "herfstvakantie", assignments: [] });
  });

  it("laat onmogelijke vrijdagplaatsen leeg en geeft een waarschuwing", () => {
    const roster = students(5, [3]);
    const result = optimizeSchedule(roster, days(3, 1, [5]));
    expect(result.schedule.flatMap((day) => day.assignments).every((item) => item.studentId === null)).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("Geen beschikbare leerling"))).toBe(true);
  });

  it("kan tweemaal optimaliseren zonder locks of tellingen te beschadigen", () => {
    const roster = students(10);
    const schedule = days(31);
    schedule[0].assignments[0] = assignment(roster[0].id, true);
    const first = optimizeSchedule(roster, schedule);
    const second = optimizeSchedule(roster, first.schedule);
    expect(second.schedule[0].assignments[0]).toEqual(assignment(roster[0].id, true));
    expect(second.schedule.flatMap((day) => day.assignments).filter((item) => item.studentId)).toHaveLength(31);
    const values = [...counts(second.schedule, roster).values()];
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    expect(second.schedule.flatMap((day) => day.assignments).filter((item) => !item.locked).every((item) => item.source === "optimizer")).toBe(true);
  });

  it("zet nooit dezelfde leerling dubbel op één poetsmoment", () => {
    const roster = students(4);
    const result = optimizeSchedule(roster, days(8, 3));
    result.schedule.forEach((day) => {
      const ids = day.assignments.map((item) => item.studentId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it("plant handmatige leerlingen nooit automatisch in", () => {
    const roster = students(8);
    roster[0].manualOnly = true;
    roster[1].manualOnly = true;
    const result = optimizeSchedule(roster, days(30));
    const totals = counts(result.schedule, roster);
    expect(totals.get(roster[0].id)).toBe(0);
    expect(totals.get(roster[1].id)).toBe(0);
    expect(result.schedule.flatMap((day) => day.assignments).filter((item) => item.studentId)).toHaveLength(30);
  });

  it("behoudt meerdere handmatige beurten zonder er automatisch toe te voegen", () => {
    const roster = students(5);
    roster[0].manualOnly = true;
    const schedule = days(15);
    schedule[5].assignments[0] = assignment(roster[0].id, true);
    schedule[7].assignments[0] = assignment(roster[0].id, true);
    const result = optimizeSchedule(roster, schedule);
    expect(counts(result.schedule, roster).get(roster[0].id)).toBe(2);
    expect(result.schedule[5].assignments[0]).toEqual(assignment(roster[0].id, true));
    expect(result.schedule[7].assignments[0]).toEqual(assignment(roster[0].id, true));
  });
});
