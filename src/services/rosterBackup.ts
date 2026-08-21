import type {
  Assignment,
  ExcludedDate,
  PersistedState,
  RosterBackupFile,
  ScheduleDay,
  Student,
  Weekday,
} from "../types";

function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

function weekday(value: unknown): value is Weekday {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 7;
}

function normalizeStudent(value: unknown): Student {
  const item = record(value, "Een leerling in de back-up is ongeldig.");
  if (typeof item.id !== "string" || !item.id || typeof item.name !== "string") {
    throw new Error("Een leerling in de back-up mist een naam of kenmerk.");
  }
  if (!Number.isInteger(item.previousYearCount) || Number(item.previousYearCount) < 0) {
    throw new Error("Een leerling heeft een ongeldig aantal eerdere poetsbeurten.");
  }
  if (!Array.isArray(item.availableWeekdays) || !item.availableWeekdays.every(weekday)) {
    throw new Error("Een leerling heeft ongeldige beschikbare weekdagen.");
  }
  return {
    id: item.id,
    name: item.name,
    previousYearCount: Number(item.previousYearCount),
    manualOnly: Boolean(item.manualOnly),
    availableWeekdays: [...new Set(item.availableWeekdays)],
  };
}

function normalizeException(value: unknown): ExcludedDate {
  const item = record(value, "Een klasuitzondering in de back-up is ongeldig.");
  if (typeof item.id !== "string" || !item.id || !validDate(item.date) ||
      typeof item.reason !== "string" || !item.reason.trim()) {
    throw new Error("Een klasuitzondering mist een geldige datum of reden.");
  }
  return { id: item.id, date: item.date, reason: item.reason.trim() };
}

function normalizeAssignment(value: unknown, studentIds: Set<string>): Assignment {
  const item = record(value, "Een toewijzing in de back-up is ongeldig.");
  const studentId = item.studentId === null ? null : item.studentId;
  if (studentId !== null && (typeof studentId !== "string" || !studentIds.has(studentId))) {
    throw new Error("Een toewijzing verwijst naar een onbekende leerling.");
  }
  if (typeof item.locked !== "boolean" || ![null, "manual", "optimizer"].includes(item.source as never)) {
    throw new Error("Een toewijzing in de back-up is ongeldig.");
  }
  return { studentId, locked: item.locked, source: item.source as Assignment["source"] };
}

function normalizeScheduleDay(value: unknown, studentIds: Set<string>): ScheduleDay {
  const item = record(value, "Een poetsdag in de back-up is ongeldig.");
  if (!validDate(item.date) || !weekday(item.weekday) || typeof item.excluded !== "boolean" ||
      !Array.isArray(item.assignments) || item.assignments.length > 20) {
    throw new Error("Een poetsdag in de back-up bevat ongeldige gegevens.");
  }
  const exclusionReason = item.exclusionReason;
  if (exclusionReason !== undefined && typeof exclusionReason !== "string") {
    throw new Error("Een poetsdag in de back-up bevat een ongeldige reden.");
  }
  return {
    date: item.date,
    weekday: item.weekday,
    excluded: item.excluded,
    exclusionReason,
    assignments: item.assignments.map((assignment) => normalizeAssignment(assignment, studentIds)),
  };
}

export function normalizeRosterBackup(input: unknown): RosterBackupFile {
  const file = record(input, "Dit is geen geldig poetsroosterbestand.");
  if (file.format !== "poetsrooster-backup" || file.version !== 1) {
    throw new Error("Dit bestand is geen ondersteunde poetsroosterback-up.");
  }
  const source = record(file.state, "De back-up bevat geen roostergegevens.");
  const settings = record(source.settings, "De planning in de back-up is ongeldig.");
  if (typeof settings.className !== "string" || !validDate(settings.startDate) ||
      !validDate(settings.endDate) || settings.endDate < settings.startDate ||
      !Array.isArray(settings.cleaningWeekdays) || !settings.cleaningWeekdays.every(weekday) ||
      !Number.isInteger(settings.studentsPerCleaningDay) ||
      Number(settings.studentsPerCleaningDay) < 1 || Number(settings.studentsPerCleaningDay) > 20) {
    throw new Error("De planning in de back-up is ongeldig.");
  }
  if (!Array.isArray(source.students) || source.students.length > 500 ||
      !Array.isArray(source.excludedDates) || source.excludedDates.length > 1000 ||
      !Array.isArray(source.schedule) || source.schedule.length > 1000) {
    throw new Error("De back-up bevat te veel of ongeldige roostergegevens.");
  }
  const students = source.students.map(normalizeStudent);
  const studentIds = new Set(students.map((student) => student.id));
  if (studentIds.size !== students.length) throw new Error("De back-up bevat dubbele leerlingkenmerken.");

  const state: PersistedState = {
    version: 1,
    settings: {
      className: settings.className,
      startDate: settings.startDate,
      endDate: settings.endDate,
      cleaningWeekdays: [...new Set(settings.cleaningWeekdays)],
      studentsPerCleaningDay: Number(settings.studentsPerCleaningDay),
    },
    students,
    excludedDates: source.excludedDates.map(normalizeException),
    schedule: source.schedule.map((day) => normalizeScheduleDay(day, studentIds)),
  };
  return {
    format: "poetsrooster-backup",
    version: 1,
    exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : "",
    state,
  };
}

export function createRosterBackup(state: PersistedState): RosterBackupFile {
  return {
    format: "poetsrooster-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    state,
  };
}

function safeFilename(value: string): string {
  const cleaned = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
  return cleaned || "poetsrooster";
}

export function downloadRosterBackup(state: PersistedState): void {
  const blob = new Blob([JSON.stringify(createRosterBackup(state), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFilename(state.settings.className)}-back-up.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function readRosterBackupFile(file: File): Promise<PersistedState> {
  if (file.size > 5_000_000) throw new Error("Het back-upbestand is te groot.");
  try {
    return normalizeRosterBackup(JSON.parse(await file.text())).state;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Het gekozen bestand bevat geen geldige JSON.");
    throw error;
  }
}
