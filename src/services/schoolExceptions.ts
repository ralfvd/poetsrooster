import type { ExcludedDate, SchoolExceptionFile } from "../types";

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function addSchoolExceptionRange(
  current: ExcludedDate[],
  startDate: string,
  endDate: string,
  reason: string,
): ExcludedDate[] {
  const cleanedReason = reason.trim();
  if (!validDate(startDate) || !validDate(endDate)) throw new Error("Kies een geldige begin- en einddatum.");
  if (endDate < startDate) throw new Error("De einddatum moet op of na de begindatum liggen.");
  if (!cleanedReason || cleanedReason.length > 200) throw new Error("Vul een reden van maximaal 200 tekens in.");

  const byDate = new Map(current.map((item) => [item.date, item]));
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const rangeLength = Math.floor((end.getTime() - cursor.getTime()) / 86_400_000) + 1;
  if (rangeLength > 500) throw new Error("Een periode mag maximaal 500 dagen bevatten.");
  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    byDate.set(date, { id: `school-${date}`, date, reason: cleanedReason });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (byDate.size > 500) throw new Error("De schoolkalender mag maximaal 500 uitzonderingsdagen bevatten.");
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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

export async function unlockSchoolExceptionEditor(adminPassword: string): Promise<void> {
  const response = await fetch("/api/school-exceptions/unlock", {
    method: "POST",
    headers: { "X-School-Admin-Password": adminPassword },
  });
  const body = await responseJson(response);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : "Beheerwachtwoord kon niet worden gecontroleerd.";
    throw new Error(message);
  }
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
