import { useEffect, useState } from "react";
import type { Student, Weekday } from "../types";
import { weekdayLabel } from "../utils/dates";
import { createId } from "../utils/id";

type Props = {
  students: Student[];
  weekdays: Weekday[];
  onChange: (students: Student[]) => void;
  onRemove: (studentId: string) => void;
};

export function addMissingStudentFields(
  students: Student[],
  total: number,
  weekdays: Weekday[],
  createStudentId: () => string = () => createId("leerling"),
): Student[] {
  if (!Number.isInteger(total) || total <= students.length || total > 100) return students;
  const additions = Array.from({ length: total - students.length }, (): Student => ({
    id: createStudentId(),
    name: "",
    previousYearCount: 0,
    manualOnly: false,
    availableWeekdays: [...weekdays],
  }));
  return [...students, ...additions];
}

export function setStudentManualOnly(student: Student, manualOnly: boolean): Student {
  return {
    ...student,
    manualOnly,
    availableWeekdays: manualOnly ? [] : student.availableWeekdays,
  };
}

export function ClassEditor({ students, weekdays, onChange, onRemove }: Props) {
  const [desiredCount, setDesiredCount] = useState(students.length ? String(students.length) : "");

  useEffect(() => {
    setDesiredCount(students.length ? String(students.length) : "");
  }, [students.length]);

  const newStudent = (name = ""): Student => ({
    id: createId("leerling"),
    name,
    previousYearCount: 0,
    manualOnly: false,
    availableWeekdays: [...weekdays],
  });

  const addStudent = () => {
    onChange([...students, newStudent(`Leerling ${students.length + 1}`)]);
  };

  const createStudentFields = () => {
    const total = Number(desiredCount);
    onChange(addMissingStudentFields(students, total, weekdays));
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
      <div className="student-count-builder">
        <label>
          Aantal leerlingen
          <input
            type="number"
            min="1"
            max="100"
            inputMode="numeric"
            placeholder="Bijv. 25"
            value={desiredCount}
            onChange={(event) => setDesiredCount(event.target.value)}
          />
        </label>
        <button
          className="button ghost"
          type="button"
          disabled={
            !Number.isInteger(Number(desiredCount)) ||
            Number(desiredCount) <= students.length ||
            Number(desiredCount) > 100
          }
          onClick={createStudentFields}
        >
          Invulvelden maken
        </button>
      </div>
      <p className="student-count-help">Bestaande leerlingen blijven staan; alleen ontbrekende invulvelden worden toegevoegd.</p>
      <div className="editor-table-wrap">
        <table className="editor-table">
          <thead>
            <tr>
              <th>Naam leerling</th>
              <th className="number-column">Vorig jaar</th>
              <th className="check-column" title="Deze leerling wordt nooit automatisch ingepland">Handmatig</th>
              {weekdays.map((weekday) => (
                <th className="check-column" key={weekday} title={weekdayLabel(weekday)}>
                  {weekdayLabel(weekday).slice(0, 2)}
                </th>
              ))}
              <th><span className="sr-only">Actie</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, studentIndex) => (
              <tr key={student.id}>
                <td>
                  <input
                    aria-label="Naam leerling"
                    placeholder={`Leerling ${studentIndex + 1}`}
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
                <td className="check-cell">
                  <input
                    aria-label={`${student.name} alleen handmatig inplannen`}
                    title="Niet meenemen in de automatische verdeling"
                    type="checkbox"
                    checked={student.manualOnly}
                    onChange={(event) => {
                      const updated = setStudentManualOnly(student, event.target.checked);
                      updateStudent(student.id, {
                        manualOnly: updated.manualOnly,
                        availableWeekdays: updated.availableWeekdays,
                      });
                    }}
                  />
                </td>
                {weekdays.map((weekday) => (
                  <td className="check-cell" key={weekday}>
                    <input
                      aria-label={`${student.name} beschikbaar op ${weekdayLabel(weekday)}`}
                      type="checkbox"
                      checked={student.availableWeekdays.includes(weekday)}
                      disabled={student.manualOnly}
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
      <p className="table-help">De <strong>naam van de leerling</strong> is het unieke herkenningspunt in het rooster. De beschikbaarheid en poetsbeurten horen bij de ouder(s)/verzorger(s) van die leerling.</p>
      <p className="table-help"><strong>Vorig jaar 0</strong> wordt bij iemand die nieuw is voor de verdeling behandeld als het gemiddelde van de anderen.</p>
      <p className="table-help"><strong>Handmatig</strong> betekent: nooit meenemen in de automatische verdeling. De weekdagen worden uitgevinkt; je kunt deze leerling zelf zo vaak als nodig inplannen.</p>
      <button className="button ghost full-width" type="button" onClick={addStudent}>
        + Leerling toevoegen
      </button>
    </section>
  );
}
