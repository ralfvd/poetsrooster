import { useEffect, useRef, useState } from "react";
import {
  addSchoolExceptionRange,
  downloadSchoolExceptions,
  readSchoolExceptionsFile,
  saveSchoolExceptions,
} from "../services/schoolExceptions";
import type { ExcludedDate, SchoolExceptionFile } from "../types";
import { formatDate } from "../utils/dates";

type Props = {
  schoolFile: SchoolExceptionFile;
  loadError: string;
  minDate: string;
  maxDate: string;
  onSaved: (file: SchoolExceptionFile) => void;
  onRefresh: () => Promise<void>;
};

export function SchoolExceptionEditor({ schoolFile, loadError, minDate, maxDate, onSaved, onRefresh }: Props) {
  const [draft, setDraft] = useState<ExcludedDate[]>(schoolFile.exceptions);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(schoolFile.exceptions), [schoolFile]);

  const addException = () => {
    try {
      setDraft(addSchoolExceptionRange(draft, startDate, endDate, reason));
      setStartDate("");
      setEndDate("");
      setReason("");
      setMessage("Periode toegevoegd. Sla de schoolkalender nog centraal op.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Periode toevoegen mislukt.");
    }
  };

  const save = async () => {
    if (!password) {
      setMessage("Vul het schoolbeheerwachtwoord in.");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveSchoolExceptions(draft, password);
      onSaved(saved);
      setMessage("Centraal opgeslagen voor alle gebruikers.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await readSchoolExceptionsFile(file);
      setDraft(imported.exceptions);
      setMessage(`${imported.exceptions.length} schooldag(en) uit JSON geladen. Sla ze nog centraal op.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Importeren mislukt.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <section className="panel school-exceptions-panel">
      <div className="section-heading row-heading">
        <div>
          <span className="eyebrow">Voor iedereen</span>
          <h2>Schoolkalender</h2>
        </div>
        <span className="count-badge">{draft.length}</span>
      </div>
      <p className="panel-help">Deze dagen gelden centraal voor alle klassen en alle gebruikers. Begin- en einddatum tellen beide mee.</p>
      {loadError && <p className="inline-error" role="alert">{loadError}</p>}
      <div className="exception-form">
        <label>
          Van
          <input
            type="date"
            min={minDate}
            max={maxDate}
            value={startDate}
            onChange={(event) => {
              const value = event.target.value;
              setStartDate(value);
              setEndDate(value);
            }}
          />
        </label>
        <label>
          Tot en met
          <input
            type="date"
            min={startDate || minDate}
            max={maxDate}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
        <label>
          Reden
          <input value={reason} placeholder="Bijv. kerstvakantie" onChange={(event) => setReason(event.target.value)} />
        </label>
        <button className="button ghost" type="button" onClick={addException} disabled={!startDate || !endDate || !reason.trim()}>
          Periode toevoegen
        </button>
      </div>
      {draft.length > 0 && (
        <ul className="exception-list">
          {draft.map((item) => (
            <li key={item.date}>
              <span><strong>{formatDate(item.date)}</strong> {item.reason}</span>
              <button
                className="icon-button danger"
                type="button"
                aria-label={`Schooldag ${item.reason} verwijderen`}
                onClick={() => setDraft((current) => current.filter((candidate) => candidate.date !== item.date))}
              >×</button>
            </li>
          ))}
        </ul>
      )}
      <label className="school-password">
        Schoolbeheerwachtwoord
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
        <span className="field-help">De beheerder stelt dit wachtwoord in via het bestand <code>.env</code> op de server.</span>
      </label>
      <button className="button primary full-width" type="button" disabled={busy} onClick={() => void save()}>
        {busy ? "Opslaan…" : "Opslaan voor alle klassen"}
      </button>
      <div className="school-file-actions">
        <button className="button ghost" type="button" onClick={() => downloadSchoolExceptions(draft)}>JSON exporteren</button>
        <button className="button ghost" type="button" onClick={() => fileInput.current?.click()}>JSON importeren</button>
        <button className="button ghost" type="button" onClick={() => void onRefresh()}>Server verversen</button>
        <input
          ref={fileInput}
          className="sr-only"
          type="file"
          accept="application/json,.json"
          onChange={(event) => void importFile(event.target.files?.[0])}
        />
      </div>
      {schoolFile.updatedAt && (
        <p className="server-updated">Server bijgewerkt: {new Date(schoolFile.updatedAt).toLocaleString("nl-NL")}</p>
      )}
      {message && <p className="school-message" role="status">{message}</p>}
    </section>
  );
}
