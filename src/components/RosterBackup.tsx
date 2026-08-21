import { useRef, useState } from "react";
import { downloadRosterBackup, readRosterBackupFile } from "../services/rosterBackup";
import type { PersistedState } from "../types";

type Props = {
  state: PersistedState;
  onImport: (state: PersistedState) => void;
};

export function RosterBackup({ state, onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const imported = await readRosterBackupFile(file);
      if (!window.confirm(
        `Back-up van ${imported.settings.className || "een naamloze klas"} importeren? De huidige invoer in deze browser wordt vervangen.`,
      )) return;
      onImport(imported);
      setMessage(`Back-up van ${imported.settings.className || "het poetsrooster"} is ingelezen.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Importeren is mislukt.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <section className="panel roster-backup-panel">
      <div className="section-heading">
        <span className="eyebrow">Overzetten</span>
        <h2>Back-up &amp; import</h2>
      </div>
      <p className="panel-help">
        Download het volledige bewerkbare rooster en lees het later op een andere computer weer in.
      </p>
      <div className="backup-actions">
        <button className="button ghost" type="button" onClick={() => downloadRosterBackup(state)}>
          Back-up downloaden
        </button>
        <button className="button ghost" type="button" onClick={() => fileInput.current?.click()}>
          Back-up importeren
        </button>
      </div>
      <input
        ref={fileInput}
        className="sr-only"
        type="file"
        accept="application/json,.json"
        onChange={(event) => void importFile(event.target.files?.[0])}
      />
      {message && <p className="school-message" role="status">{message}</p>}
    </section>
  );
}
