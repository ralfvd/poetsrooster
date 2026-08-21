import type { ExcludedDate, SchoolExceptionFile } from "../types";

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function normalizeSchoolExceptionFile(input: unknown): SchoolExceptionFile {
  if (!input || typeof input !== "object" || !("exceptions" in input) || !Array.isArray(input.exceptions)) {
    throw new Error("Ongeldig JSON-bestand: 'exceptions' moet een lijst zijn.");
  }
  const byDate = new Map<string, ExcludedDate>();
  for (const value of input.exceptions) {
    if (!value || typeof value !== "object" || !("date" in value) || typeof value.date !== "string" || !validDate(value.date)) {
      throw new Error("Een schooldag bevat geen geldige datum.");
    }
    const reason = "reason" in value && typeof value.reason === "string" ? value.reason.trim() : "";
    if (!reason || reason.length > 200) throw new Error("Een schooldag bevat geen geldige reden.");
    const id = "id" in value && typeof value.id === "string" && value.id.trim()
      ? value.id.trim()
      : `school-${value.date}`;
    byDate.set(value.date, { id, date: value.date, reason });
  }
  const updatedAt = "updatedAt" in input && typeof input.updatedAt === "string" ? input.updatedAt : null;
  return {
    version: 1,
    updatedAt,
    exceptions: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function loadSchoolExceptions(): Promise<SchoolExceptionFile> {
  const response = await fetch("/api/school-exceptions", { cache: "no-store" });
  const body = await responseJson(response);
  if (!response.ok) throw new Error("Schoolkalender kon niet van de server worden geladen.");
  return normalizeSchoolExceptionFile(body);
}

export async function saveSchoolExceptions(
  exceptions: ExcludedDate[],
  adminPassword: string,
): Promise<SchoolExceptionFile> {
  const response = await fetch("/api/school-exceptions", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-School-Admin-Password": adminPassword,
    },
    body: JSON.stringify({ version: 1, updatedAt: null, exceptions }),
  });
  const body = await responseJson(response);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "Schoolkalender kon niet worden opgeslagen.";
    throw new Error(message);
  }
  return normalizeSchoolExceptionFile(body);
}

export function downloadSchoolExceptions(exceptions: ExcludedDate[]): void {
  const file: SchoolExceptionFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    exceptions: [...exceptions].sort((a, b) => a.date.localeCompare(b.date)),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "school-uitzonderingen.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readSchoolExceptionsFile(file: File): Promise<SchoolExceptionFile> {
  return normalizeSchoolExceptionFile(JSON.parse(await file.text()));
}
