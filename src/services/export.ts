import type { jsPDF } from "jspdf";
import type { SheetData } from "write-excel-file/browser";
import type { ScheduleDay, ScheduleSettings, Student, Weekday } from "../types";
import { formatDate, formatLongDate, shortWeekdayLabel, weekdayLabel } from "../utils/dates";
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

export function buildPrintedOnLabel(date = new Date()): string {
  return `Afgedrukt op ${date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

function buildCreatedOnLabel(date = new Date()): string {
  return `Gemaakt op ${date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

function exportRows(
  schedule: ScheduleDay[],
  students: Student[],
  weekdays: Weekday[],
  options: { shortWeekdays?: boolean; noteSeparator?: string } = {},
): ExportRow[] {
  const noteSeparator = options.noteSeparator ?? "; ";
  const studentsById = new Map(students.map((student) => [student.id, student.name || "Naamloos"]));
  return groupScheduleByWeek(schedule).map(({ weekStart, days }) => {
    const values: Record<number, string> = {};
    const changeNotes: string[] = [];
    for (const weekday of weekdays) {
      const day = days.get(weekday);
      values[weekday] = !day
        ? "-"
        : day.excluded
          ? "--"
          : day.assignments
              .map((assignment) => {
                const currentName = assignment.studentId ? studentsById.get(assignment.studentId) ?? "--" : "--";
                if (!Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId")) return currentName;
                const previousName = assignment.changedFromStudentId
                  ? studentsById.get(assignment.changedFromStudentId) ?? "--"
                  : "--";
                const dayLabel = options.shortWeekdays ? shortWeekdayLabel(weekday) : weekdayLabel(weekday);
                changeNotes.push(`${dayLabel}: ${previousName} → ${currentName}`);
                return `${currentName}*`;
              })
              .join(", ");
    }
    const notes = [
      formatExclusionNotes(days.values(), noteSeparator, options.shortWeekdays),
      ...changeNotes,
    ].filter(Boolean).join(noteSeparator);
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

function excelDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function buildScheduleExcelData(
  settings: ScheduleSettings,
  schedule: ScheduleDay[],
  students: Student[],
  createdAt = new Date(),
): SheetData {
  const rows = exportRows(schedule, students, settings.cleaningWeekdays, {
    shortWeekdays: true,
    noteSeparator: "\n",
  });
  const columnCount = settings.cleaningWeekdays.length + 2;
  const mergedRow = (value: string, style: Record<string, unknown> = {}) => [
    { value, columnSpan: columnCount, ...style },
    ...Array.from({ length: columnCount - 1 }, () => null),
  ];
  const border = { borderColor: "#AAB5B2", borderStyle: "thin" };

  return [
    mergedRow(buildScheduleTitle(settings.className), {
      height: 28,
      fontSize: 16,
      fontWeight: "bold",
      textColor: "#173C38",
      alignVertical: "center",
    }),
    mergedRow(`${formatLongDate(settings.startDate)} t/m ${formatLongDate(settings.endDate)}`, {
      height: 20,
      textColor: "#455754",
    }),
    mergedRow(buildCreatedOnLabel(createdAt), {
      height: 18,
      fontSize: 9,
      fontStyle: "italic",
      textColor: "#65716E",
    }),
    ["Week van", ...settings.cleaningWeekdays.map(weekdayLabel), "Opmerkingen"].map((value) => ({
      value,
      height: 26,
      fontWeight: "bold",
      textColor: "#FFFFFF",
      backgroundColor: "#165C56",
      alignVertical: "center",
      wrap: true,
      ...border,
    })),
    ...rows.map((row, index) => {
      const backgroundColor = index % 2 === 1 ? "#F2F2F2" : "#FFFFFF";
      const cellStyle = {
        height: 25,
        backgroundColor,
        alignVertical: "center",
        wrap: true,
        ...border,
      };
      return [
        { value: excelDate(row.weekStart), format: "dd-mm-yyyy", fontWeight: "bold", ...cellStyle },
        ...settings.cleaningWeekdays.map((weekday) => ({ value: row.days[weekday], ...cellStyle })),
        { value: row.notes, ...cellStyle },
      ];
    }),
  ] as SheetData;
}

export async function downloadScheduleExcel(
  settings: ScheduleSettings,
  schedule: ScheduleDay[],
  students: Student[],
): Promise<void> {
  const { default: writeExcelFile } = await import("write-excel-file/browser");
  const columns = [
    { width: 14 },
    ...settings.cleaningWeekdays.map(() => ({ width: 25 })),
    { width: 44 },
  ];
  await writeExcelFile(buildScheduleExcelData(settings, schedule, students), {
    sheet: "Poetsrooster",
    columns,
    orientation: "landscape",
    stickyRowsCount: 4,
    showGridLines: false,
    zoomScale: 0.9,
  }, {
    fontFamily: "Aptos",
    fontSize: 10,
  }).toFile(`${safeFilename(settings.className)}-poetsrooster.xlsx`);
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
  const rows = exportRows(schedule, students, settings.cleaningWeekdays, {
    shortWeekdays: true,
    noteSeparator: "\n",
  });
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
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(6.5);
  doc.text(buildPrintedOnLabel(), pageWidth - margin, 14, { align: "right" });
  doc.setTextColor(25, 37, 34);

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
      const rawLines = (values[index] ?? "").split("\n").filter(Boolean);
      const lines = rawLines.length > 2
        ? [rawLines[0], rawLines.slice(1).join("; ")]
        : rawLines.length ? rawLines : [""];
      const textLines = lines.map((line) => truncate(doc, line, width - 2));
      const lineHeight = Math.min(1.75, height / Math.max(textLines.length, 1));
      const firstLineY = y + height / 2 - ((textLines.length - 1) * lineHeight) / 2;
      textLines.forEach((text, lineIndex) => {
        doc.text(text, x + 1, firstLineY + lineIndex * lineHeight, { baseline: "middle" });
      });
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
