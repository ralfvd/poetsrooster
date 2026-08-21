import type { ScheduleDay, Student, Weekday } from "../types";
import { formatDate, weekdayLabel } from "../utils/dates";
import { formatExclusionNotes } from "../utils/exclusions";
import { groupScheduleByWeek } from "../utils/schedule";

type Props = {
  schedule: ScheduleDay[];
  students: Student[];
  weekdays: Weekday[];
  onAssign: (date: string, slot: number, studentId: string | null) => void;
  onUnlock: (date: string, slot: number) => void;
};

export function ScheduleTable({ schedule, students, weekdays, onAssign, onUnlock }: Props) {
  const groups = groupScheduleByWeek(schedule);
  const sortedStudents = [...students].sort((a, b) => a.name.localeCompare(b.name, "nl"));

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
                        <div className={`assignment ${assignment.locked ? "is-locked" : ""}`} key={slot}>
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
                        </div>
                      ))}
                    </div>
                    <span className="print-only print-assignment-names">
                      {day.assignments
                        .map((assignment) =>
                          students.find((student) => student.id === assignment.studentId)?.name || "--",
                        )
                        .join(", ")}
                    </span>
                  </td>
                );
              })}
              <td className="notes-cell">
                {formatExclusionNotes(days.values())}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
