import type { ExcludedDate, ScheduleDay } from "../types";
import { shortWeekdayLabel, weekdayLabel } from "./dates";

export function mergeExclusions(
  schoolExclusions: ExcludedDate[],
  classExclusions: ExcludedDate[],
): ExcludedDate[] {
  const byDate = new Map<string, ExcludedDate>();
  for (const exclusion of schoolExclusions) byDate.set(exclusion.date, exclusion);
  for (const exclusion of classExclusions) byDate.set(exclusion.date, exclusion);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatExclusionNotes(
  days: Iterable<ScheduleDay>,
  separator = " · ",
  shortWeekdays = false,
): string {
  const excludedDays = [...days].filter((day) => day.excluded);
  const reasons = [...new Set(
    excludedDays.map((day) => day.exclusionReason ?? "Uitgesloten"),
  )];

  if (excludedDays.length > 1 && reasons.length === 1) {
    return reasons[0];
  }

  return excludedDays
    .map((day) => `${shortWeekdays ? shortWeekdayLabel(day.weekday) : weekdayLabel(day.weekday)}: ${day.exclusionReason ?? "Uitgesloten"}`)
    .join(separator);
}
