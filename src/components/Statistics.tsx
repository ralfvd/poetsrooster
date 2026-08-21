import type { ScheduleDay, Student, Weekday } from "../types";
import { weekdayLabel } from "../utils/dates";
import { calculateStatistics } from "../utils/schedule";

type Props = { students: Student[]; schedule: ScheduleDay[]; weekdays: Weekday[] };

function formatWeeks(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

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
              <th>Leerling</th><th>Handmatig</th><th>Vorig jaar</th><th>Dit jaar</th><th>Totaal</th>
              {weekdays.map((weekday) => <th key={weekday}>{weekdayLabel(weekday).slice(0, 2)}</th>)}
              <th title="Minimale periode tussen twee poetsbeurten">Min. weken</th>
              <th title="Gemiddelde periode tussen twee poetsbeurten">Gem. weken</th>
              <th title="Maximale periode tussen twee poetsbeurten">Max. weken</th>
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
                <td>{formatWeeks(stat.minimumIntervalWeeks)}</td>
                <td>{formatWeeks(stat.averageIntervalWeeks)}</td>
                <td>{formatWeeks(stat.maximumIntervalWeeks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
