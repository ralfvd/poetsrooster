import { useState } from "react";
import type { ExcludedDate } from "../types";
import { formatDate } from "../utils/dates";

type Props = {
  exclusions: ExcludedDate[];
  minDate: string;
  maxDate: string;
  onChange: (exclusions: ExcludedDate[]) => void;
};

export function ExceptionEditor({ exclusions, minDate, maxDate, onChange }: Props) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const addException = () => {
    if (!date || !reason.trim()) return;
    const existing = exclusions.find((item) => item.date === date);
    if (existing) {
      onChange(exclusions.map((item) => (item.id === existing.id ? { ...item, reason: reason.trim() } : item)));
    } else {
      onChange([...exclusions, { id: crypto.randomUUID(), date, reason: reason.trim() }]);
    }
    setDate("");
    setReason("");
  };

  return (
    <section className="panel exceptions-panel">
      <div className="section-heading">
        <span className="eyebrow">Kalender</span>
        <h2>Uitzonderingen</h2>
      </div>
      <div className="exception-form">
        <label>
          Datum
          <input type="date" min={minDate} max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label>
          Reden
          <input value={reason} placeholder="Bijv. herfstvakantie" onChange={(event) => setReason(event.target.value)} />
        </label>
        <button className="button ghost" type="button" onClick={addException} disabled={!date || !reason.trim()}>
          Uitzondering toevoegen
        </button>
      </div>
      {exclusions.length > 0 && (
        <ul className="exception-list">
          {[...exclusions].sort((a, b) => a.date.localeCompare(b.date)).map((item) => (
            <li key={item.id}>
              <span><strong>{formatDate(item.date)}</strong> {item.reason}</span>
              <button
                className="icon-button danger"
                type="button"
                aria-label={`Uitzondering ${item.reason} verwijderen`}
                onClick={() => onChange(exclusions.filter((candidate) => candidate.id !== item.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
