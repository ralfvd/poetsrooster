import type { jsPDF } from "jspdf";
import type { ScheduleDay, ScheduleSettings, Student, Weekday } from "../types";
import { formatDate, formatLongDate, weekdayLabel } from "../utils/dates";
import { formatExclusionNotes } from "../utils/exclusions";
import { groupScheduleByWeek } from "../utils/schedule";

type ExportRow = {
  weekStart: string;
  days: Record<number, string>;
  notes: string;
};

function cleanCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

export function buildScheduleTitle(className: string): string {
  const cleanedClassName = cleanCell(className);
  return cleanedClassName ? `Poetsrooster ${cleanedClassName}` : "Poetsrooster";
}

function exportRows(
  schedule: ScheduleDay[],
  students: Student[],
  weekdays: Weekday[],
): ExportRow[] {
  const studentsById = new Map(students.map((student) => [student.id, student.name || "Naamloos"]));
  return groupScheduleByWeek(schedule).map(({ weekStart, days }) => {
    const values: Record<number, string> = {};
    for (const weekday of weekdays) {
      const day = days.get(weekday);
      values[weekday] = !day
        ? "-"
        : day.excluded
          ? "--"
          : day.assignments
              .map((assignment) => assignment.studentId ? studentsById.get(assignment.studentId) ?? "--" : "--")
              .join(", ");
    }
    const notes = formatExclusionNotes(days.values(), "; ");
    return { weekStart, days: values, notes };
  });
}

export function buildScheduleTsv(
  schedule: ScheduleDay[],
  students: Student[],
  weekdays: Weekday[],
): string {
  const header = ["Week van", ...weekdays.map(weekdayLabel), "Opmerkingen"];
  const rows = exportRows(schedule, students, weekdays).map((row) => [
    formatDate(row.weekStart),
    ...weekdays.map((weekday) => row.days[weekday]),
    row.notes,
  ]);
  return [header, ...rows].map((row) => row.map(cleanCell).join("\t")).join("\n");
}

export async function copyScheduleToClipboard(
  schedule: ScheduleDay[],
  students: Student[],
  weekdays: Weekday[],
): Promise<void> {
  const text = buildScheduleTsv(schedule, students, weekdays);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Kopiëren wordt niet ondersteund door deze browser.");
}

function safeFilename(value: string): string {
  const cleaned = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return cleaned || "poetsrooster";
}

function truncate(doc: jsPDF, value: string, maxWidth: number): string {
  const clean = cleanCell(value);
  if (doc.getTextWidth(clean) <= maxWidth) return clean;
  let result = clean;
  while (result.length > 1 && doc.getTextWidth(`${result}...`) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result.trimEnd()}...`;
}

export async function createSchedulePdf(
  settings: ScheduleSettings,
  schedule: ScheduleDay[],
  students: Student[],
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 7;
  const tableTop = 22;
  const headerHeight = 5.5;
  const rows = exportRows(schedule, students, settings.cleaningWeekdays);
  const rowHeight = Math.min(5.2, (pageHeight - margin - tableTop - headerHeight) / Math.max(rows.length, 1));
  const firstColumnWidth = 23;
  const notesWidth = 42;
  const weekdayWidth = (pageWidth - margin * 2 - firstColumnWidth - notesWidth) /
    Math.max(settings.cleaningWeekdays.length, 1);
  const columns = [firstColumnWidth, ...settings.cleaningWeekdays.map(() => weekdayWidth), notesWidth];

  doc.setTextColor(25, 37, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(buildScheduleTitle(settings.className), margin, 9.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `${formatLongDate(settings.startDate)} t/m ${formatLongDate(settings.endDate)}`,
    margin,
    14,
  );

  const drawRow = (values: string[], y: number, height: number, header = false, shaded = false) => {
    let x = margin;
    doc.setFont("helvetica", header ? "bold" : "normal");
    doc.setFontSize(header ? 7 : Math.max(4.5, Math.min(7, rowHeight * 1.35)));
    for (let index = 0; index < columns.length; index += 1) {
      const width = columns[index];
      if (header) {
        doc.setFillColor(232, 232, 232);
        doc.rect(x, y, width, height, "FD");
      } else if (shaded) {
        doc.setFillColor(244, 244, 244);
        doc.rect(x, y, width, height, "FD");
      } else {
        doc.rect(x, y, width, height, "S");
      }
      const text = truncate(doc, values[index] ?? "", width - 2);
      doc.text(text, x + 1, y + height / 2, { baseline: "middle" });
      x += width;
    }
  };

  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.15);
  drawRow(
    ["Week van", ...settings.cleaningWeekdays.map(weekdayLabel), "Opmerkingen"],
    tableTop,
    headerHeight,
    true,
  );
  rows.forEach((row, index) => {
    drawRow(
      [
        formatDate(row.weekStart),
        ...settings.cleaningWeekdays.map((weekday) => row.days[weekday]),
        row.notes,
      ],
      tableTop + headerHeight + index * rowHeight,
      rowHeight,
      false,
      index % 2 === 1,
    );
  });

  return doc;
}

export async function downloadSchedulePdf(
  settings: ScheduleSettings,
  schedule: ScheduleDay[],
  students: Student[],
): Promise<void> {
  const doc = await createSchedulePdf(settings, schedule, students);
  doc.save(`${safeFilename(settings.className)}-poetsrooster.pdf`);
}
