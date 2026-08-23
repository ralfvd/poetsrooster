import type { PersistedState } from "../types";
import { normalizeRosterBackup } from "./rosterBackup";

export class ServerRosterError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ServerRosterSaveResult = {
  updated: boolean;
};

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessage(body: unknown, fallback: string): string {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : fallback;
}

export async function saveRosterToServer(
  parentName: string,
  password: string,
  passwordConfirmation: string,
  state: PersistedState,
): Promise<ServerRosterSaveResult> {
  const response = await fetch("/api/parent-rosters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentName, password, passwordConfirmation, state }),
  });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new ServerRosterError(response.status, errorMessage(body, "Opslaan op de server is mislukt."));
  }
  return {
    updated: Boolean(body && typeof body === "object" && "updated" in body && body.updated === true),
  };
}

export async function loadRosterFromServer(parentName: string, password: string): Promise<PersistedState> {
  const response = await fetch("/api/parent-rosters/load", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parentName, password }),
  });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new ServerRosterError(response.status, errorMessage(body, "Ophalen van de server is mislukt."));
  }
  const state = body && typeof body === "object" && "state" in body ? body.state : null;
  return normalizeRosterBackup({
    format: "poetsrooster-backup",
    version: 1,
    exportedAt: "",
    state,
  }).state;
}
