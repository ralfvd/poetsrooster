import { describe, expect, it } from "vitest";
import { addSchoolExceptionRange, normalizeSchoolExceptionFile } from "./schoolExceptions";

describe("school exception JSON", () => {
  it("maakt alle dagen van een vakantieperiode inclusief begin- en einddatum", () => {
    expect(addSchoolExceptionRange([], "2026-10-17", "2026-10-20", "Herfstvakantie")).toEqual([
      { id: "school-2026-10-17", date: "2026-10-17", reason: "Herfstvakantie" },
      { id: "school-2026-10-18", date: "2026-10-18", reason: "Herfstvakantie" },
      { id: "school-2026-10-19", date: "2026-10-19", reason: "Herfstvakantie" },
      { id: "school-2026-10-20", date: "2026-10-20", reason: "Herfstvakantie" },
    ]);
  });

  it("overschrijft overlappende schooldagen zonder dubbele datums", () => {
    const current = [{ id: "bestaand", date: "2026-10-19", reason: "Oud" }];
    const result = addSchoolExceptionRange(current, "2026-10-19", "2026-10-20", "Vakantie");
    expect(result).toHaveLength(2);
    expect(result.every((item) => item.reason === "Vakantie")).toBe(true);
  });

  it("weigert een einddatum voor de begindatum", () => {
    expect(() => addSchoolExceptionRange([], "2026-10-20", "2026-10-19", "Vakantie")).toThrow(
      "De einddatum moet op of na de begindatum liggen.",
    );
  });

  it("accepteert een geldige export en vult ontbrekende ids aan", () => {
    expect(normalizeSchoolExceptionFile({
      version: 1,
      exceptions: [{ date: "2026-12-25", reason: "kerstvakantie" }],
    })).toEqual({
      version: 1,
      updatedAt: null,
      exceptions: [{ id: "school-2026-12-25", date: "2026-12-25", reason: "kerstvakantie" }],
    });
  });

  it("weigert ongeldige datums", () => {
    expect(() => normalizeSchoolExceptionFile({ exceptions: [{ date: "geen datum", reason: "fout" }] })).toThrow();
  });
});
