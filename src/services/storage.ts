import type { PersistedState } from "../types";

export interface StorageProvider {
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = "poetsrooster:v1";

export class LocalStorageProvider implements StorageProvider {
  async load(): Promise<PersistedState | null> {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PersistedState;
      return parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  async save(state: PersistedState): Promise<void> {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  async clear(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }
}
