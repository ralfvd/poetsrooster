import type { OptimizerResult, ScheduleDay, Student } from "../types";
import { daysBetween, weekdayLabel } from "../utils/dates";

type CandidateState = {
  count: number;
  dates: string[];
  weekdayCounts: Record<number, number>;
};

type Slot = { dayIndex: number; assignmentIndex: number; candidateCount: number; date: string };

function cloneSchedule(schedule: ScheduleDay[]): ScheduleDay[] {
  return schedule.map((day) => ({
    ...day,
    assignments: day.assignments.map((assignment) => ({ ...assignment })),
  }));
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function optimizeSchedule(students: Student[], input: ScheduleDay[]): OptimizerResult {
  const schedule = cloneSchedule(input);
  const validStudents = new Map(students.map((student) => [student.id, student]));
  const state = new Map<string, CandidateState>(
    students.map((student) => [student.id, { count: 0, dates: [], weekdayCounts: {} }]),
  );
  const warnings: string[] = [];

  for (const day of schedule) {
    if (day.excluded) {
      day.assignments = [];
      continue;
    }
    for (const assignment of day.assignments) {
      if (!assignment.locked) {
        assignment.studentId = null;
        assignment.source = null;
        continue;
      }
      if (!assignment.studentId || !validStudents.has(assignment.studentId)) {
        assignment.studentId = null;
        assignment.locked = false;
        assignment.source = null;
        warnings.push(`Een vastgezette toewijzing op ${day.date} verwees niet naar een bestaande leerling.`);
        continue;
      }
      const candidate = state.get(assignment.studentId)!;
      candidate.count += 1;
      candidate.dates.push(day.date);
      candidate.weekdayCounts[day.weekday] = (candidate.weekdayCounts[day.weekday] ?? 0) + 1;
    }
  }

  const slots: Slot[] = [];
  schedule.forEach((day, dayIndex) => {
    if (day.excluded) return;
    day.assignments.forEach((assignment, assignmentIndex) => {
      if (assignment.locked) return;
      const candidateCount = students.filter(
        (student) => !student.manualOnly && student.availableWeekdays.includes(day.weekday),
      ).length;
      slots.push({ dayIndex, assignmentIndex, candidateCount, date: day.date });
    });
  });
  slots.sort((a, b) => a.candidateCount - b.candidateCount || a.date.localeCompare(b.date));

  for (const slot of slots) {
    const day = schedule[slot.dayIndex];
    const alreadyAssigned = new Set(
      day.assignments.map((assignment) => assignment.studentId).filter((id): id is string => Boolean(id)),
    );
    const candidates = students.filter(
      (student) =>
        !student.manualOnly &&
        student.availableWeekdays.includes(day.weekday) &&
        !alreadyAssigned.has(student.id),
    );
    candidates.sort((a, b) => {
      const aState = state.get(a.id)!;
      const bState = state.get(b.id)!;
      const aDistance = aState.dates.length
        ? Math.min(...aState.dates.map((date) => daysBetween(date, day.date)))
        : Number.MAX_SAFE_INTEGER;
      const bDistance = bState.dates.length
        ? Math.min(...bState.dates.map((date) => daysBetween(date, day.date)))
        : Number.MAX_SAFE_INTEGER;
      return (
        aState.count - bState.count ||
        a.previousYearCount + aState.count - (b.previousYearCount + bState.count) ||
        bDistance - aDistance ||
        (aState.weekdayCounts[day.weekday] ?? 0) - (bState.weekdayCounts[day.weekday] ?? 0) ||
        hash(`${day.date}:${slot.assignmentIndex}:${a.id}`) - hash(`${day.date}:${slot.assignmentIndex}:${b.id}`)
      );
    });

    const selected = candidates[0];
    if (!selected) {
      warnings.push(`Geen beschikbare leerling voor ${weekdayLabel(day.weekday).toLowerCase()} ${day.date}.`);
      continue;
    }
    day.assignments[slot.assignmentIndex] = {
      studentId: selected.id,
      locked: false,
      source: "optimizer",
    };
    const selectedState = state.get(selected.id)!;
    selectedState.count += 1;
    selectedState.dates.push(day.date);
    selectedState.weekdayCounts[day.weekday] = (selectedState.weekdayCounts[day.weekday] ?? 0) + 1;
  }

  const counts = students
    .filter((student) => !student.manualOnly)
    .map((student) => state.get(student.id)!.count);
  if (counts.length > 1 && Math.max(...counts) - Math.min(...counts) > 1) {
    warnings.unshift("De verdeling is niet volledig gelijk door beschikbaarheid of vastgezette toewijzingen.");
  }
  return { schedule, warnings: [...new Set(warnings)] };
}
