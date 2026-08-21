import { describe, expect, it } from "vitest";
import type { ScheduleDay } from "../types";
import { formatExclusionNotes, mergeExclusions } from "./exclusions";

function excludedDay(weekday: ScheduleDay["weekday"], reason: string): ScheduleDay {
  return {
    date: `2027-02-0${weekday}`,
    weekday,
    excluded: true,
    exclusionReason: reason,
    assignments: [],
  };
}

describe("mergeExclusions", () => {
  it("combineert school- en klasdagen en laat een klasreden voorgaan", () => {
    const result = mergeExclusions(
      [
        { id: "school-1", date: "2026-10-14", reason: "schoolvakantie" },
        { id: "school-2", date: "2027-01-01", reason: "feestdag" },
      ],
      [{ id: "class-1", date: "2026-10-14", reason: "klasactiviteit" }],
    );
    expect(result).toEqual([
      { id: "class-1", date: "2026-10-14", reason: "klasactiviteit" },
      { id: "school-2", date: "2027-01-01", reason: "feestdag" },
    ]);
  });
});

describe("formatExclusionNotes", () => {
  it("toont een gelijke reden maar één keer zonder weekdagen", () => {
    expect(formatExclusionNotes([
      excludedDay(3, "carnavalsvakantie"),
      excludedDay(5, "carnavalsvakantie"),
    ])).toBe("carnavalsvakantie");
  });

  it("noemt de weekdagen wanneer de redenen verschillen", () => {
    expect(formatExclusionNotes([
      excludedDay(3, "studiedag"),
      excludedDay(5, "feestdag"),
    ])).toBe("Woensdag: studiedag · Vrijdag: feestdag");
  });

  it("behoudt de weekdag voor één losse uitzonderingsdag", () => {
    expect(formatExclusionNotes([
      excludedDay(3, "studiedag"),
    ])).toBe("Woensdag: studiedag");
  });
});
