import type { ScheduleSettings as Settings, Weekday } from "../types";
import { WEEKDAYS } from "../utils/dates";

type Props = {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onGenerate: () => void;
};

export function ScheduleSettings({ settings, onChange, onGenerate }: Props) {
  const toggleWeekday = (weekday: Weekday) => {
    const selected = settings.cleaningWeekdays.includes(weekday);
    const cleaningWeekdays = selected
      ? settings.cleaningWeekdays.filter((item) => item !== weekday)
      : [...settings.cleaningWeekdays, weekday].sort();
    onChange({ ...settings, cleaningWeekdays });
  };

  return (
    <section className="panel settings-panel">
      <div className="section-heading">
        <span className="eyebrow">Basis</span>
        <h2>Planning</h2>
      </div>
      <label>
        Klasnaam
        <input
          value={settings.className}
          onChange={(event) => onChange({ ...settings, className: event.target.value })}
          placeholder="Bijv. Groep 7B"
        />
      </label>
      <div className="field-grid">
        <label>
          Startdatum
          <input
            type="date"
            value={settings.startDate}
            onChange={(event) => onChange({ ...settings, startDate: event.target.value })}
          />
        </label>
        <label>
          Einddatum
          <input
            type="date"
            value={settings.endDate}
            onChange={(event) => onChange({ ...settings, endDate: event.target.value })}
          />
        </label>
      </div>
      <fieldset>
        <legend>Poetsdagen</legend>
        <div className="weekday-picker">
          {WEEKDAYS.slice(0, 5).map((day) => (
            <label className={settings.cleaningWeekdays.includes(day.value) ? "selected" : ""} key={day.value}>
              <input
                type="checkbox"
                checked={settings.cleaningWeekdays.includes(day.value)}
                onChange={() => toggleWeekday(day.value)}
              />
              {day.short}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Ouders/verzorgers per poetsdag
        <input
          type="number"
          min="1"
          max="10"
          value={settings.studentsPerCleaningDay}
          onChange={(event) =>
            onChange({ ...settings, studentsPerCleaningDay: Math.max(1, Number(event.target.value)) })
          }
        />
      </label>
      <button className="button secondary full-width" type="button" onClick={onGenerate}>
        Poetsdagen genereren
      </button>
    </section>
  );
}
