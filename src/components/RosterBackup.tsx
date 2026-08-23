import { type FormEvent, useRef, useState } from "react";
import { downloadRosterBackup, readRosterBackupFile } from "../services/rosterBackup";
import { loadRosterFromServer, saveRosterToServer } from "../services/serverRoster";
import type { PersistedState } from "../types";

type Props = {
  state: PersistedState;
  onImport: (state: PersistedState) => void;
};

export function RosterBackup({ state, onImport }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [serverMessage, setServerMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveParentName, setSaveParentName] = useState("");
  const [savePassword, setSavePassword] = useState("");
  const [savePasswordConfirmation, setSavePasswordConfirmation] = useState("");
  const [loadParentName, setLoadParentName] = useState("");
  const [loadPassword, setLoadPassword] = useState("");

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

  const saveOnServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerMessage("");
    if (savePassword !== savePasswordConfirmation) {
      setServerMessage("De twee wachtwoorden zijn niet hetzelfde.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveRosterToServer(saveParentName, savePassword, savePasswordConfirmation, state);
      setSavePassword("");
      setSavePasswordConfirmation("");
      setServerMessage(result.updated
        ? "Bestaande serverback-up bijgewerkt met de nieuwste gegevens."
        : "Nieuwe serverback-up opgeslagen. Bewaar uw voornaam en wachtwoord goed; deze kunnen niet worden hersteld.");
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Opslaan op de server is mislukt.");
    } finally {
      setSaving(false);
    }
  };

  const loadFromServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerMessage("");
    setLoading(true);
    try {
      const imported = await loadRosterFromServer(loadParentName, loadPassword);
      if (!window.confirm(
        `Serverback-up van ${imported.settings.className || "een naamloze klas"} ophalen? De huidige invoer in deze browser wordt vervangen.`,
      )) return;
      onImport(imported);
      setLoadPassword("");
      setServerMessage(`Serverback-up van ${imported.settings.className || "het poetsrooster"} is opgehaald.`);
    } catch (error) {
      setServerMessage(error instanceof Error ? error.message : "Ophalen van de server is mislukt.");
    } finally {
      setLoading(false);
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
      <details className="server-roster-backup">
        <summary>Optioneel opslaan of ophalen via de server</summary>
        <div className="server-roster-content">
          <p className="panel-help">
            Bewaar het volledige rooster versleuteld op de server. Uw voornaam en wachtwoord vormen samen de toegang.
            Met een bestaande combinatie werkt u dezelfde serverback-up bij.
          </p>
          <form className="server-roster-form" onSubmit={(event) => void saveOnServer(event)}>
            <h3>Serverback-up opslaan of bijwerken</h3>
            <label>
              Voornaam ouder
              <input
                type="text"
                value={saveParentName}
                maxLength={60}
                autoComplete="given-name"
                required
                onChange={(event) => setSaveParentName(event.target.value)}
              />
            </label>
            <label>
              Wachtwoord
              <input
                type="password"
                value={savePassword}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required
                onChange={(event) => setSavePassword(event.target.value)}
              />
              <span className="field-help">Minimaal 8 tekens. Dit wachtwoord kan niet worden hersteld.</span>
            </label>
            <label>
              Wachtwoord herhalen
              <input
                type="password"
                value={savePasswordConfirmation}
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                required
                onChange={(event) => setSavePasswordConfirmation(event.target.value)}
              />
            </label>
            <button className="button primary full-width" type="submit" disabled={saving || loading}>
              {saving ? "Opslaan…" : "Op server opslaan"}
            </button>
          </form>

          <form className="server-roster-form" onSubmit={(event) => void loadFromServer(event)}>
            <h3>Bestaande serverback-up ophalen</h3>
            <label>
              Voornaam ouder
              <input
                type="text"
                value={loadParentName}
                maxLength={60}
                autoComplete="username"
                required
                onChange={(event) => setLoadParentName(event.target.value)}
              />
            </label>
            <label>
              Wachtwoord
              <input
                type="password"
                value={loadPassword}
                minLength={8}
                maxLength={128}
                autoComplete="current-password"
                required
                onChange={(event) => setLoadPassword(event.target.value)}
              />
            </label>
            <button className="button ghost full-width" type="submit" disabled={saving || loading}>
              {loading ? "Ophalen…" : "Van server ophalen"}
            </button>
          </form>
          {serverMessage && <p className="school-message" role="status">{serverMessage}</p>}
        </div>
      </details>
    </section>
  );
}
