import type { Student, Weekday } from "../types";
import { weekdayLabel } from "../utils/dates";

type Props = {
  students: Student[];
  weekdays: Weekday[];
  onChange: (students: Student[]) => void;
  onRemove: (studentId: string) => void;
};

export function ClassEditor({ students, weekdays, onChange, onRemove }: Props) {
  const addStudent = () => {
    onChange([
      ...students,
      {
        id: crypto.randomUUID(),
        name: `Leerling ${students.length + 1}`,
        previousYearCount: 0,
        availableWeekdays: [...weekdays],
      },
    ]);
  };

  const updateStudent = (id: string, patch: Partial<Student>) => {
    onChange(students.map((student) => (student.id === id ? { ...student, ...patch } : student)));
  };

  const toggleAvailability = (student: Student, weekday: Weekday) => {
    const availableWeekdays = student.availableWeekdays.includes(weekday)
      ? student.availableWeekdays.filter((item) => item !== weekday)
      : [...student.availableWeekdays, weekday].sort();
    updateStudent(student.id, { availableWeekdays });
  };

  return (
    <section className="panel students-panel">
      <div className="section-heading row-heading">
        <div>
          <span className="eyebrow">Klas</span>
          <h2>Leerlingen</h2>
        </div>
        <span className="count-badge">{students.length}</span>
      </div>
      <div className="editor-table-wrap">
        <table className="editor-table">
          <thead>
            <tr>
              <th>Naam</th>
              <th className="number-column">Vorig jaar</th>
              {weekdays.map((weekday) => (
                <th className="check-column" key={weekday} title={weekdayLabel(weekday)}>
                  {weekdayLabel(weekday).slice(0, 2)}
                </th>
              ))}
              <th><span className="sr-only">Actie</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td>
                  <input
                    aria-label="Naam leerling"
                    value={student.name}
                    onChange={(event) => updateStudent(student.id, { name: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Aantal vorig jaar voor ${student.name}`}
                    type="number"
                    min="0"
                    value={student.previousYearCount}
                    onChange={(event) =>
                      updateStudent(student.id, { previousYearCount: Math.max(0, Number(event.target.value)) })
                    }
                  />
                </td>
                {weekdays.map((weekday) => (
                  <td className="check-cell" key={weekday}>
                    <input
                      aria-label={`${student.name} beschikbaar op ${weekdayLabel(weekday)}`}
                      type="checkbox"
                      checked={student.availableWeekdays.includes(weekday)}
                      onChange={() => toggleAvailability(student, weekday)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label={`${student.name} verwijderen`}
                    title="Leerling verwijderen"
                    onClick={() => onRemove(student.id)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {students.length === 0 && <p className="empty-copy">Voeg de leerlingen toe om te beginnen.</p>}
      <button className="button ghost full-width" type="button" onClick={addStudent}>
        + Kind toevoegen
      </button>
    </section>
  );
}
