import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistedState } from "../types";
import { loadRosterFromServer, saveRosterToServer, ServerRosterError } from "./serverRoster";

const state: PersistedState = {
  version: 1,
  settings: {
    className: "Groep 7B",
    startDate: "2026-08-24",
    endDate: "2027-07-19",
    cleaningWeekdays: [3, 5],
    studentsPerCleaningDay: 1,
  },
  students: [],
  excludedDates: [],
  schedule: [],
};

afterEach(() => vi.unstubAllGlobals());

describe("serverback-up", () => {
  it("stuurt bij opslaan beide wachtwoordvelden en alle roostergegevens", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      createdAt: "2026-08-23T10:00:00Z",
      updatedAt: "2026-08-23T10:00:00Z",
      updated: false,
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(saveRosterToServer("Ralf", "lang-wachtwoord", "lang-wachtwoord", state))
      .resolves.toEqual({ updated: false });
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(request.body)).toEqual({
      parentName: "Ralf",
      password: "lang-wachtwoord",
      passwordConfirmation: "lang-wachtwoord",
      state,
    });
  });

  it("herkent wanneer een bestaande serverback-up is bijgewerkt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ updated: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    await expect(saveRosterToServer("Ralf", "lang-wachtwoord", "lang-wachtwoord", state))
      .resolves.toEqual({ updated: true });
  });

  it("valideert opgehaalde roostergegevens opnieuw in de browser", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ state }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    await expect(loadRosterFromServer("Ralf", "lang-wachtwoord")).resolves.toEqual(state);
  });

  it("geeft een servermelding en statuscode door", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Combinatie bestaat al." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    })));
    await expect(saveRosterToServer("Ralf", "lang-wachtwoord", "lang-wachtwoord", state))
      .rejects.toEqual(new ServerRosterError(409, "Combinatie bestaat al."));
  });
});
