export type RuntimeConfig = {
  feedbackWhatsappNumber: string;
};

export function normalizeFeedbackWhatsappNumber(value: unknown): string {
  const number = typeof value === "string" ? value.trim() : "";
  return /^316\d{8}$/.test(number) ? number : "";
}

export function normalizeRuntimeConfig(input: unknown): RuntimeConfig {
  const feedbackWhatsappNumber = input && typeof input === "object" && "feedbackWhatsappNumber" in input
    ? normalizeFeedbackWhatsappNumber(input.feedbackWhatsappNumber)
    : "";
  return { feedbackWhatsappNumber };
}

export function buildWhatsappFeedbackUrl(number: string): string {
  const normalized = normalizeFeedbackWhatsappNumber(number);
  if (!normalized) return "";
  const message = encodeURIComponent("Hoi, ik heb feedback over Poetsrooster:");
  return `https://wa.me/${normalized}?text=${message}`;
}

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const response = await fetch("/api/config", { cache: "no-store" });
  if (!response.ok) throw new Error("Appconfiguratie kon niet van de server worden geladen.");
  return normalizeRuntimeConfig(await response.json());
}
