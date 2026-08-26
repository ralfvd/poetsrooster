import { describe, expect, it } from "vitest";
import type { ScheduleDay, Student, Weekday } from "../types";
import { acceptScheduleAdjustments, hasScheduleAdjustments, minimallyAdjustSchedule } from "./scheduleAdjustment";

function student(id: string, availableWeekdays: Weekday[]): Student {
  return { id, name: id.toUpperCase(), previousYearCount: 2, manualOnly: false, availableWeekdays };
}

function day(date: string, weekday: Weekday, studentId: string, locked = false): ScheduleDay {
  return {
    date,
    weekday,
    excluded: false,
    assignments: [{ studentId, locked, source: locked ? "manual" : "optimizer" }],
  };
}

describe("minimale roosterwijziging", () => {
  it("kiest een directe ruil op dezelfde voorkeursdag en markeert beide plekken", () => {
    const roster = [student("a", [3, 5]), student("b", [3, 5]), student("c", [3])];
    const schedule = [
      day("2026-09-02", 3, "a"),
      day("2026-10-02", 5, "b"),
      day("2026-10-07", 3, "c"),
    ];

    const result = minimallyAdjustSchedule(roster, schedule, "2026-09-02", 0);

    expect(result.success).toBe(true);
    expect(result.changedCount).toBe(2);
    expect(result.schedule[0].assignments[0]).toMatchObject({ studentId: "c", changedFromStudentId: "a" });
    expect(result.schedule[2].assignments[0]).toMatchObject({ studentId: "a", changedFromStudentId: "c" });
    expect(result.schedule[1].assignments[0].studentId).toBe("b");
  });

  it("vindt een ketting van drie wanneer een directe ruil niet past bij de beschikbare dagen", () => {
    const roster = [
      student("a", [3, 5]),
      student("b", [1, 5]),
      student("c", [1, 3]),
    ];
    const schedule = [
      day("2026-09-02", 3, "a"),
      day("2026-10-02", 5, "b"),
      day("2026-11-02", 1, "c"),
    ];

    const result = minimallyAdjustSchedule(roster, schedule, "2026-09-02", 0);

    expect(result.success).toBe(true);
    expect(result.changedCount).toBe(3);
    expect(result.schedule.map((item) => item.assignments[0].studentId)).toEqual(["c", "a", "b"]);
  });

  it("wijzigt geen vaste plaats en meldt wanneer geen geldige ruil bestaat", () => {
    const roster = [student("a", [3]), student("b", [5])];
    const schedule = [day("2026-09-02", 3, "a"), day("2026-10-02", 5, "b", true)];

    const result = minimallyAdjustSchedule(roster, schedule, "2026-09-02", 0);

    expect(result.success).toBe(false);
    expect(result.schedule).toBe(schedule);
    expect(result.message).toContain("Geen geldige ruil");
  });

  it("respecteert minimaal vier weken tussen de verplaatste en andere beurten", () => {
    const roster = [student("a", [3]), student("b", [3])];
    const schedule = [
      day("2026-09-02", 3, "a"),
      day("2026-09-09", 3, "b"),
      day("2026-10-01", 3, "a"),
    ];

    const result = minimallyAdjustSchedule(roster, schedule, "2026-09-02", 0);

    expect(result.success).toBe(false);
  });

  it("ruilt een leerling niet naar een datum waarop die vooraf als verhinderd is aangevinkt", () => {
    const roster = [student("a", [3]), student("b", [3])];
    const schedule = [day("2026-09-02", 3, "a"), day("2026-10-07", 3, "b")];
    schedule[0].unavailableStudentIds = ["b"];

    const result = minimallyAdjustSchedule(roster, schedule, "2026-09-02", 0);

    expect(result.success).toBe(false);
  });

  it("kan wijzigingsmarkeringen als nieuw uitgangspunt accepteren", () => {
    const schedule = [day("2026-09-02", 3, "a")];
    schedule[0].assignments[0].changedFromStudentId = "b";
    expect(hasScheduleAdjustments(schedule)).toBe(true);
    expect(acceptScheduleAdjustments(schedule)[0].assignments[0]).toEqual({
      studentId: "a",
      locked: false,
      source: "optimizer",
    });
  });
});
