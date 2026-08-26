import type { Weekday } from "../types";

export const WEEKDAYS: { value: Weekday; label: string; short: string }[] = [
  { value: 1, label: "Maandag", short: "Ma" },
  { value: 2, label: "Dinsdag", short: "Di" },
  { value: 3, label: "Woensdag", short: "Wo" },
  { value: 4, label: "Donderdag", short: "Do" },
  { value: 5, label: "Vrijdag", short: "Vr" },
  { value: 6, label: "Zaterdag", short: "Za" },
  { value: 7, label: "Zondag", short: "Zo" },
];

export function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

export function isoWeekday(date: Date): Weekday {
  return (date.getUTCDay() || 7) as Weekday;
}

export function startOfWeek(value: string): string {
  const date = parseDate(value);
  return toDateString(addDays(date, 1 - isoWeekday(date)));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(parseDate(value)).replaceAll(".", "");
}

export function formatLongDate(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDate(value));
}

export function weekdayLabel(weekday: Weekday): string {
  return WEEKDAYS.find((day) => day.value === weekday)?.label ?? "";
}

export function shortWeekdayLabel(weekday: Weekday): string {
  return WEEKDAYS.find((day) => day.value === weekday)?.short ?? "";
}

export function daysBetween(a: string, b: string): number {
  return Math.abs((parseDate(a).getTime() - parseDate(b).getTime()) / 86_400_000);
}
