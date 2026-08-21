import { describe, expect, it } from "vitest";
import { createId } from "./id";

describe("createId", () => {
  it("gebruikt randomUUID wanneer dat beschikbaar is", () => {
    expect(createId("leerling", { randomUUID: () => "vaste-uuid" })).toBe("vaste-uuid");
  });

  it("maakt ook zonder randomUUID een geldig uniek ID", () => {
    let seed = 0;
    const cryptoWithoutRandomUuid = {
      getRandomValues: (values: Uint8Array) => {
        values.forEach((_, index) => { values[index] = seed + index; });
        seed += 1;
        return values;
      },
    };

    const first = createId("leerling", cryptoWithoutRandomUuid);
    const second = createId("leerling", cryptoWithoutRandomUuid);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });

  it("heeft een laatste terugval voor browsers zonder Web Crypto", () => {
    expect(createId("leerling", null)).toMatch(/^leerling-/);
  });
});
