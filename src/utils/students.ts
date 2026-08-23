import type { Student, Weekday } from "../types";

function normalizedStudentName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("nl");
}

export function duplicateStudentNameIds(students: Student[]): Set<string> {
  const idsByName = new Map<string, string[]>();
  for (const student of students) {
    const name = normalizedStudentName(student.name);
    if (!name) continue;
    idsByName.set(name, [...(idsByName.get(name) ?? []), student.id]);
  }
  return new Set(
    [...idsByName.values()]
      .filter((studentIds) => studentIds.length > 1)
      .flat(),
  );
}

export function needsAvailabilityWarning(student: Student, weekday: Weekday): boolean {
  return !student.manualOnly && !student.availableWeekdays.includes(weekday);
}
