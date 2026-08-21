import { describe, expect, it } from "vitest";
import { normalizeSchoolExceptionFile } from "./schoolExceptions";

describe("school exception JSON", () => {
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
