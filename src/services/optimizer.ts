import type { OptimizerResult, ScheduleDay, Student, Weekday } from "../types";
import { daysBetween, weekdayLabel } from "../utils/dates";

type CandidateState = {
  count: number;
  dates: string[];
  weekdayCounts: Record<number, number>;
};

type Slot = { dayIndex: number; assignmentIndex: number; candidateCount: number; date: string };

export const MINIMUM_AUTOMATIC_INTERVAL_DAYS = 28;

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

export function effectivePreviousYearCounts(students: Student[]): Map<string, number> {
  const automaticallyScheduled = students.filter((student) => !student.manualOnly);
  const knownCounts = automaticallyScheduled
    .map((student) => student.previousYearCount)
    .filter((count) => count > 0);
  const averageKnownCount = knownCounts.length
    ? knownCounts.reduce((total, count) => total + count, 0) / knownCounts.length
    : 0;

  return new Map(students.map((student) => [
    student.id,
    student.previousYearCount === 0 && knownCounts.length ? averageKnownCount : student.previousYearCount,
  ]));
}

function preferredWeekdays(
  students: Student[],
  schedule: ScheduleDay[],
  state: Map<string, CandidateState>,
  seed: number,
): Map<string, Weekday> {
  const demand = new Map<Weekday, number>();
  for (const day of schedule) {
    if (!day.excluded) demand.set(day.weekday, (demand.get(day.weekday) ?? 0) + day.assignments.length);
  }
  const preferenceLoad = new Map<Weekday, number>();
  const result = new Map<string, Weekday>();
  const candidates = students
    .filter((student) => !student.manualOnly)
    .sort((a, b) =>
      a.availableWeekdays.length - b.availableWeekdays.length ||
      hash(`${seed}:student:${a.id}`) - hash(`${seed}:student:${b.id}`),
    );

  for (const student of candidates) {
    const available = student.availableWeekdays.filter((weekday) => (demand.get(weekday) ?? 0) > 0);
    if (!available.length) continue;
    const lockedCounts = state.get(student.id)?.weekdayCounts ?? {};
    const highestLockedCount = Math.max(0, ...available.map((weekday) => lockedCounts[weekday] ?? 0));
    const preferred = [...available].sort((a, b) => {
      if (highestLockedCount > 0) {
        const lockedDifference = (lockedCounts[b] ?? 0) - (lockedCounts[a] ?? 0);
        if (lockedDifference) return lockedDifference;
      }
      const aLoad = (preferenceLoad.get(a) ?? 0) / (demand.get(a) ?? 1);
      const bLoad = (preferenceLoad.get(b) ?? 0) / (demand.get(b) ?? 1);
      return aLoad - bLoad || hash(`${seed}:weekday:${student.id}:${a}`) - hash(`${seed}:weekday:${student.id}:${b}`);
    })[0];
    result.set(student.id, preferred);
    preferenceLoad.set(preferred, (preferenceLoad.get(preferred) ?? 0) + 1);
  }
  return result;
}

export function optimizeSchedule(
  students: Student[],
  input: ScheduleDay[],
  seed = Math.floor(Math.random() * 4_294_967_296),
): OptimizerResult {
  const schedule = cloneSchedule(input);
  const validStudents = new Map(students.map((student) => [student.id, student]));
  const state = new Map<string, CandidateState>(
    students.map((student) => [student.id, { count: 0, dates: [], weekdayCounts: {} }]),
  );
  const warnings: string[] = [];
  const previousYearCounts = effectivePreviousYearCounts(students);

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
  slots.sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.candidateCount - b.candidateCount ||
    a.assignmentIndex - b.assignmentIndex,
  );
  const preferredByStudent = preferredWeekdays(students, schedule, state, seed);

  for (const slot of slots) {
    const day = schedule[slot.dayIndex];
    const alreadyAssigned = new Set(
      day.assignments.map((assignment) => assignment.studentId).filter((id): id is string => Boolean(id)),
    );
    const availableCandidates = students.filter(
      (student) =>
        !student.manualOnly &&
        student.availableWeekdays.includes(day.weekday) &&
        !alreadyAssigned.has(student.id),
    );
    const candidates = availableCandidates.filter((student) =>
      state.get(student.id)!.dates.every(
        (assignedDate) => daysBetween(assignedDate, day.date) >= MINIMUM_AUTOMATIC_INTERVAL_DAYS,
      ),
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
        previousYearCounts.get(a.id)! + aState.count - (previousYearCounts.get(b.id)! + bState.count) ||
        Number(preferredByStudent.get(a.id) !== day.weekday) - Number(preferredByStudent.get(b.id) !== day.weekday) ||
        bDistance - aDistance ||
        (bState.weekdayCounts[day.weekday] ?? 0) - (aState.weekdayCounts[day.weekday] ?? 0) ||
        hash(`${seed}:${day.date}:${slot.assignmentIndex}:${a.id}`) - hash(`${seed}:${day.date}:${slot.assignmentIndex}:${b.id}`)
      );
    });

    const selected = candidates[0];
    if (!selected) {
      warnings.push(
        availableCandidates.length
          ? `Geen leerling kon op ${weekdayLabel(day.weekday).toLowerCase()} ${day.date} automatisch worden ingepland met minimaal vier weken tussen twee poetsbeurten.`
          : `Geen beschikbare leerling voor ${weekdayLabel(day.weekday).toLowerCase()} ${day.date}.`,
      );
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
