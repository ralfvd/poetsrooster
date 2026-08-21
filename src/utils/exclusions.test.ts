import { describe, expect, it } from "vitest";
import { mergeExclusions } from "./exclusions";

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
