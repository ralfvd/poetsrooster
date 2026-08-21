import type { ExcludedDate } from "../types";

export function mergeExclusions(
  schoolExclusions: ExcludedDate[],
  classExclusions: ExcludedDate[],
): ExcludedDate[] {
  const byDate = new Map<string, ExcludedDate>();
  for (const exclusion of schoolExclusions) byDate.set(exclusion.date, exclusion);
  for (const exclusion of classExclusions) byDate.set(exclusion.date, exclusion);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
