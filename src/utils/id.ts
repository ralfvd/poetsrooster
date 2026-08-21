type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (values: Uint8Array) => Uint8Array;
};

let fallbackCounter = 0;

export function createId(
  prefix = "item",
  cryptoSource: CryptoLike | null | undefined = globalThis.crypto as CryptoLike | undefined,
): string {
  if (typeof cryptoSource?.randomUUID === "function") return cryptoSource.randomUUID();

  if (typeof cryptoSource?.getRandomValues === "function") {
    const bytes = cryptoSource.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  }

  fallbackCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
