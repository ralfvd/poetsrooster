import type { Assignment, ScheduleDay, Student, Weekday } from "../types";
import { daysBetween, formatDate } from "../utils/dates";
import { MINIMUM_AUTOMATIC_INTERVAL_DAYS } from "./optimizer";

type Slot = {
  key: string;
  dayIndex: number;
  slotIndex: number;
  date: string;
  weekday: Weekday;
  studentId: string;
  assignment: Assignment;
};

type Cycle = {
  slots: Slot[];
  weekdayChanges: number;
  movedDays: number;
};

export type ScheduleAdjustmentResult =
  | { success: true; schedule: ScheduleDay[]; changedCount: number; message: string }
  | { success: false; schedule: ScheduleDay[]; changedCount: 0; message: string };

const MAXIMUM_CYCLE_LENGTH = 4;

function cloneSchedule(schedule: ScheduleDay[]): ScheduleDay[] {
  return schedule.map((day) => ({
    ...day,
    assignments: day.assignments.map((assignment) => ({ ...assignment })),
  }));
}

function slotKey(dayIndex: number, slotIndex: number): string {
  return `${dayIndex}:${slotIndex}`;
}

function changedBaseline(assignment: Assignment): string | null {
  return Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId")
    ? assignment.changedFromStudentId ?? null
    : assignment.studentId;
}

export function hasScheduleAdjustments(schedule: ScheduleDay[]): boolean {
  return schedule.some((day) => day.assignments.some((assignment) =>
    Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId"),
  ));
}

export function acceptScheduleAdjustments(schedule: ScheduleDay[]): ScheduleDay[] {
  return schedule.map((day) => ({
    ...day,
    assignments: day.assignments.map(({ changedFromStudentId: _changedFromStudentId, ...assignment }) => assignment),
  }));
}

export function minimallyAdjustSchedule(
  students: Student[],
  input: ScheduleDay[],
  targetDate: string,
  targetSlotIndex: number,
): ScheduleAdjustmentResult {
  const schedule = cloneSchedule(input);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const slots: Slot[] = [];
  const datesByStudent = new Map<string, Slot[]>();

  schedule.forEach((day, dayIndex) => {
    day.assignments.forEach((assignment, slotIndex) => {
      if (!assignment.studentId) return;
      const slot: Slot = {
        key: slotKey(dayIndex, slotIndex),
        dayIndex,
        slotIndex,
        date: day.date,
        weekday: day.weekday,
        studentId: assignment.studentId,
        assignment,
      };
      const studentDates = datesByStudent.get(slot.studentId) ?? [];
      studentDates.push(slot);
      datesByStudent.set(slot.studentId, studentDates);
      const student = studentsById.get(slot.studentId);
      if (!assignment.locked && student && !student.manualOnly) slots.push(slot);
    });
  });

  const target = slots.find((slot) => slot.date === targetDate && slot.slotIndex === targetSlotIndex);
  if (!target) {
    return {
      success: false,
      schedule: input,
      changedCount: 0,
      message: "Deze beurt kan niet automatisch worden aangepast. Hef zo nodig eerst het slotje op.",
    };
  }

  const canMove = (source: Slot, destination: Slot): boolean => {
    if (source.key === destination.key || source.studentId === destination.studentId || source.date === destination.date) {
      return false;
    }
    const student = studentsById.get(source.studentId);
    if (!student?.availableWeekdays.includes(destination.weekday)) return false;
    if (schedule[destination.dayIndex].unavailableStudentIds?.includes(source.studentId)) return false;
    return (datesByStudent.get(source.studentId) ?? []).every((other) =>
      other.key === source.key || daysBetween(other.date, destination.date) >= MINIMUM_AUTOMATIC_INTERVAL_DAYS,
    );
  };

  const edgeScore = (source: Slot, destination: Slot) => ({
    weekdayChanges: source.weekday === destination.weekday ? 0 : 1,
    movedDays: daysBetween(source.date, destination.date),
  });

  const betterCycle = (candidate: Cycle, current: Cycle | null): boolean =>
    !current ||
    candidate.weekdayChanges < current.weekdayChanges ||
    (candidate.weekdayChanges === current.weekdayChanges && candidate.movedDays < current.movedDays) ||
    (candidate.weekdayChanges === current.weekdayChanges && candidate.movedDays === current.movedDays &&
      candidate.slots.map((slot) => slot.key).join("|") < current.slots.map((slot) => slot.key).join("|"));

  let selectedCycle: Cycle | null = null;
  for (let length = 2; length <= MAXIMUM_CYCLE_LENGTH && !selectedCycle; length += 1) {
    let bestAtLength: Cycle | null = null;
    const search = (
      path: Slot[],
      usedStudents: Set<string>,
      weekdayChanges: number,
      movedDays: number,
    ) => {
      const source = path[path.length - 1];
      if (path.length === length) {
        if (!canMove(source, target)) return;
        const finalScore = edgeScore(source, target);
        const candidate = {
          slots: [...path],
          weekdayChanges: weekdayChanges + finalScore.weekdayChanges,
          movedDays: movedDays + finalScore.movedDays,
        };
        if (betterCycle(candidate, bestAtLength)) bestAtLength = candidate;
        return;
      }

      for (const destination of slots) {
        if (destination.key === target.key || path.some((slot) => slot.key === destination.key) ||
            usedStudents.has(destination.studentId) || !canMove(source, destination)) continue;
        const score = edgeScore(source, destination);
        search(
          [...path, destination],
          new Set([...usedStudents, destination.studentId]),
          weekdayChanges + score.weekdayChanges,
          movedDays + score.movedDays,
        );
      }
    };
    search([target], new Set([target.studentId]), 0, 0);
    selectedCycle = bestAtLength;
  }

  const cycle = selectedCycle as Cycle | null;
  if (!cycle) {
    const studentName = studentsById.get(target.studentId)?.name || "Deze ouder/verzorger";
    return {
      success: false,
      schedule: input,
      changedCount: 0,
      message: `Geen geldige ruil gevonden voor ${studentName} op ${formatDate(target.date)} zonder vaste keuzes, beschikbaarheid of de vierwekengrens te schenden.`,
    };
  }

  cycle.slots.forEach((source, index) => {
    const destination = cycle.slots[(index + 1) % cycle.slots.length];
    const destinationAssignment = schedule[destination.dayIndex].assignments[destination.slotIndex];
    const baseline = changedBaseline(destinationAssignment);
    const changedAssignment: Assignment = {
      studentId: source.studentId,
      locked: false,
      source: "optimizer",
    };
    if (baseline !== source.studentId) changedAssignment.changedFromStudentId = baseline;
    schedule[destination.dayIndex].assignments[destination.slotIndex] = changedAssignment;
  });

  const changedCount = cycle.slots.length;
  return {
    success: true,
    schedule,
    changedCount,
    message: `${changedCount} plekken aangepast. De gewijzigde plekken zijn gemarkeerd ten opzichte van de eerdere verdeling.`,
  };
}
