import type { ScheduleDay, Student, Weekday } from "../types";
import { formatDate, shortWeekdayLabel, weekdayLabel } from "../utils/dates";
import { formatExclusionNotes } from "../utils/exclusions";
import { groupScheduleByWeek } from "../utils/schedule";

type Props = {
  schedule: ScheduleDay[];
  students: Student[];
  weekdays: Weekday[];
  advancedMode: boolean;
  onAssign: (date: string, slot: number, studentId: string | null) => void;
  onUnlock: (date: string, slot: number) => void;
  onUnavailable: (date: string, slot: number) => void;
  onDateUnavailableChange: (date: string, studentId: string, unavailable: boolean) => void;
};

function scheduleNotes(
  days: Iterable<ScheduleDay>,
  studentsById: Map<string, Student>,
  shortWeekdays = false,
  separator = " · ",
): string {
  const dayList = [...days];
  return [
    formatExclusionNotes(dayList, separator, shortWeekdays),
    ...dayList.flatMap((day) => day.assignments.flatMap((assignment) => {
      if (!Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId")) return [];
      const previous = assignment.changedFromStudentId
        ? studentsById.get(assignment.changedFromStudentId)?.name || "Naamloos"
        : "leeg";
      const current = assignment.studentId
        ? studentsById.get(assignment.studentId)?.name || "Naamloos"
        : "leeg";
      const dayLabel = shortWeekdays ? shortWeekdayLabel(day.weekday) : weekdayLabel(day.weekday);
      return [`${dayLabel}: ${previous} → ${current}`];
    })),
  ].filter(Boolean).join(separator);
}

export function ScheduleTable({
  schedule,
  students,
  weekdays,
  advancedMode,
  onAssign,
  onUnlock,
  onUnavailable,
  onDateUnavailableChange,
}: Props) {
  const groups = groupScheduleByWeek(schedule);
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const studentsById = new Map(students.map((student) => [student.id, student]));

  if (groups.length === 0) {
    return <div className="empty-schedule">Genereer eerst de poetsdagen om het rooster te vullen.</div>;
  }

  return (
    <div className="schedule-scroll">
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Week van</th>
            {weekdays.map((weekday) => <th key={weekday}>{weekdayLabel(weekday)}</th>)}
            <th>Opmerkingen</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(({ weekStart, days }) => (
            <tr key={weekStart}>
              <th scope="row">{formatDate(weekStart)}</th>
              {weekdays.map((weekday) => {
                const day = days.get(weekday);
                if (!day) return <td key={weekday} className="muted-cell">—</td>;
                if (day.excluded) return <td key={weekday} className="excluded-cell">--</td>;
                return (
                  <td key={weekday}>
                    <div className="assignment-stack no-print">
                      {day.assignments.map((assignment, slot) => (
                        <div
                          className={`assignment ${assignment.locked ? "is-locked" : ""} ${Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId") ? "is-adjusted" : ""}`}
                          key={slot}
                        >
                          <select
                            aria-label={`${weekdayLabel(weekday)} ${formatDate(day.date)}, plek ${slot + 1}`}
                            value={assignment.studentId ?? ""}
                            onChange={(event) => onAssign(day.date, slot, event.target.value || null)}
                          >
                            <option value="">Nog niet ingevuld</option>
                            {sortedStudents.map((student) => (
                              <option key={student.id} value={student.id}>{student.name || "Naamloos"}</option>
                            ))}
                          </select>
                          {assignment.locked && (
                            <button
                              type="button"
                              className="lock-button"
                              title="Vastzetten opheffen"
                              aria-label="Vastzetten opheffen"
                              onClick={() => onUnlock(day.date, slot)}
                            >
                              <span aria-hidden="true">🔒</span><span className="lock-label"> Vast</span>
                            </button>
                          )}
                          {advancedMode && assignment.studentId && !assignment.locked &&
                            !studentsById.get(assignment.studentId)?.manualOnly && (
                            <button
                              type="button"
                              className="unavailable-button"
                              title="Ouder/verzorger kan niet op deze datum"
                              onClick={() => onUnavailable(day.date, slot)}
                            >
                              Kan niet
                            </button>
                          )}
                          {Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId") && (
                            <span className="adjustment-label">
                              Gewijzigd · was {assignment.changedFromStudentId
                                ? studentsById.get(assignment.changedFromStudentId)?.name || "Naamloos"
                                : "leeg"}
                            </span>
                          )}
                        </div>
                      ))}
                      {advancedMode && (
                        <details className="date-unavailability">
                          <summary>
                            Kan niet op deze datum
                            {day.unavailableStudentIds?.length ? ` (${day.unavailableStudentIds.length})` : ""}
                          </summary>
                          <div className="date-unavailability-list">
                            {sortedStudents.map((student) => (
                              <label key={student.id}>
                                <input
                                  type="checkbox"
                                  checked={day.unavailableStudentIds?.includes(student.id) ?? false}
                                  onChange={(event) => onDateUnavailableChange(day.date, student.id, event.target.checked)}
                                />
                                <span>{student.name || "Naamloos"}</span>
                              </label>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                    <span className="print-only print-assignment-names">
                      {day.assignments
                        .map((assignment) =>
                          `${studentsById.get(assignment.studentId ?? "")?.name || "--"}${
                            Object.prototype.hasOwnProperty.call(assignment, "changedFromStudentId") ? "*" : ""
                          }`,
                        )
                        .join(", ")}
                    </span>
                  </td>
                );
              })}
              <td className="notes-cell">
                <span className="no-print">{scheduleNotes(days.values(), studentsById)}</span>
                <span className="print-only print-notes">
                  {scheduleNotes(days.values(), studentsById, true, "\n")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
