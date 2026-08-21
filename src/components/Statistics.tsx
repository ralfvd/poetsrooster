import type { ScheduleDay, Student, Weekday } from "../types";
import { weekdayLabel } from "../utils/dates";
import { calculateStatistics } from "../utils/schedule";

type Props = { students: Student[]; schedule: ScheduleDay[]; weekdays: Weekday[] };

export function Statistics({ students, schedule, weekdays }: Props) {
  const statistics = calculateStatistics(students, schedule);
  return (
    <section className="statistics-section">
      <div className="section-heading">
        <span className="eyebrow">Controle</span>
        <h2>Verdeling per leerling</h2>
      </div>
      <div className="stats-scroll">
        <table className="statistics-table">
          <thead>
            <tr>
              <th>Kind</th><th>Handmatig</th><th>Vorig jaar</th><th>Dit jaar</th><th>Totaal</th>
              {weekdays.map((weekday) => <th key={weekday}>{weekdayLabel(weekday).slice(0, 2)}</th>)}
            </tr>
          </thead>
          <tbody>
            {statistics.map((stat) => (
              <tr key={stat.student.id}>
                <th scope="row">{stat.student.name || "Naamloos"}</th>
                <td>{stat.student.manualOnly ? "Ja" : "—"}</td>
                <td>{stat.student.previousYearCount}</td>
                <td><strong>{stat.currentYearCount}</strong></td>
                <td>{stat.totalCount}</td>
                {weekdays.map((weekday) => <td key={weekday}>{stat.weekdayCounts[weekday] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
