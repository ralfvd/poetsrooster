import { describe, expect, it } from "vitest";
import {
  buildWhatsappFeedbackUrl,
  normalizeFeedbackWhatsappNumber,
  normalizeRuntimeConfig,
} from "./runtimeConfig";

describe("runtimeconfiguratie", () => {
  it("accepteert een Nederlands WhatsApp-nummer in internationaal formaat", () => {
    expect(normalizeFeedbackWhatsappNumber("31612345678")).toBe("31612345678");
    expect(normalizeRuntimeConfig({ feedbackWhatsappNumber: "31612345678" }))
      .toEqual({ feedbackWhatsappNumber: "31612345678" });
  });

  it("weigert plusjes, spaties en andere ongeldige waarden", () => {
    expect(normalizeFeedbackWhatsappNumber("+31612345678")).toBe("");
    expect(normalizeFeedbackWhatsappNumber("316 12345678")).toBe("");
    expect(normalizeFeedbackWhatsappNumber("javascript:alert(1)")).toBe("");
    expect(normalizeRuntimeConfig(null)).toEqual({ feedbackWhatsappNumber: "" });
  });

  it("maakt een WhatsApp-link met een vooraf ingevulde feedbacktekst", () => {
    expect(buildWhatsappFeedbackUrl("31612345678"))
      .toBe("https://wa.me/31612345678?text=Hoi%2C%20ik%20heb%20feedback%20over%20Poetsrooster%3A");
    expect(buildWhatsappFeedbackUrl("ongeldig")).toBe("");
  });
});
