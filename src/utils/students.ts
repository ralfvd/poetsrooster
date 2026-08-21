import type { Student, Weekday } from "../types";

export function needsAvailabilityWarning(student: Student, weekday: Weekday): boolean {
  return !student.manualOnly && !student.availableWeekdays.includes(weekday);
}
