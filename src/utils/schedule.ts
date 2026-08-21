import type {
  Assignment,
  ExcludedDate,
  ScheduleDay,
  ScheduleSettings,
  Student,
  StudentStatistic,
  Weekday,
} from "../types";
import { addDays, daysBetween, isoWeekday, parseDate, startOfWeek, toDateString } from "./dates";

const emptyAssignment = (): Assignment => ({ studentId: null, locked: false, source: null });

export function generateSchedule(
  settings: ScheduleSettings,
  excludedDates: ExcludedDate[],
  existing: ScheduleDay[] = [],
): ScheduleDay[] {
  if (!settings.startDate || !settings.endDate || settings.endDate < settings.startDate) return [];

  const previous = new Map(existing.map((day) => [day.date, day]));
  const exclusions = new Map(excludedDates.map((item) => [item.date, item.reason]));
  const result: ScheduleDay[] = [];
  for (
    let date = parseDate(settings.startDate);
    date <= parseDate(settings.endDate);
    date = addDays(date, 1)
  ) {
    const weekday = isoWeekday(date);
    if (!settings.cleaningWeekdays.includes(weekday)) continue;
    const dateString = toDateString(date);
    const exclusionReason = exclusions.get(dateString);
    const old = previous.get(dateString);
    const assignments = exclusionReason
      ? []
      : Array.from({ length: settings.studentsPerCleaningDay }, (_, index) =>
          old?.assignments[index] ? { ...old.assignments[index] } : emptyAssignment(),
        );
    result.push({
      date: dateString,
      weekday,
      excluded: Boolean(exclusionReason),
      exclusionReason,
      assignments,
    });
  }
  return result;
}

export function groupScheduleByWeek(schedule: ScheduleDay[]) {
  const groups = new Map<string, Map<Weekday, ScheduleDay>>();
  for (const day of schedule) {
    const week = startOfWeek(day.date);
    if (!groups.has(week)) groups.set(week, new Map());
    groups.get(week)?.set(day.weekday, day);
  }
  return [...groups.entries()].map(([weekStart, days]) => ({ weekStart, days }));
}

export function calculateStatistics(
  students: Student[],
  schedule: ScheduleDay[],
): StudentStatistic[] {
  const stats = students.map((student) => ({
    student,
    currentYearCount: 0,
    totalCount: student.previousYearCount,
    weekdayCounts: {} as Record<number, number>,
    minimumIntervalWeeks: null as number | null,
    averageIntervalWeeks: null as number | null,
    maximumIntervalWeeks: null as number | null,
  }));
  const byId = new Map(stats.map((stat) => [stat.student.id, stat]));
  const datesById = new Map(students.map((student) => [student.id, [] as string[]]));
  for (const day of schedule) {
    for (const assignment of day.assignments) {
      if (!assignment.studentId) continue;
      const stat = byId.get(assignment.studentId);
      if (!stat) continue;
      stat.currentYearCount += 1;
      stat.totalCount += 1;
      stat.weekdayCounts[day.weekday] = (stat.weekdayCounts[day.weekday] ?? 0) + 1;
      datesById.get(assignment.studentId)?.push(day.date);
    }
  }
  for (const stat of stats) {
    const dates = datesById.get(stat.student.id)?.sort() ?? [];
    if (dates.length < 2) continue;
    const intervals = dates.slice(1).map((date, index) => daysBetween(dates[index], date) / 7);
    stat.minimumIntervalWeeks = Math.min(...intervals);
    stat.averageIntervalWeeks = intervals.reduce((total, interval) => total + interval, 0) / intervals.length;
    stat.maximumIntervalWeeks = Math.max(...intervals);
  }
  return stats.sort((a, b) => a.student.name.localeCompare(b.student.name, "nl"));
}

export function activeSlotCount(schedule: ScheduleDay[]): number {
  return schedule.reduce((sum, day) => sum + (day.excluded ? 0 : day.assignments.length), 0);
}

export function filledSlotCount(schedule: ScheduleDay[]): number {
  return schedule.reduce(
    (sum, day) => sum + day.assignments.filter((assignment) => assignment.studentId).length,
    0,
  );
}
