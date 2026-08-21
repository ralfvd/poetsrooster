import { useEffect, useMemo, useState } from "react";
import { ClassEditor } from "./components/ClassEditor";
import { ExceptionEditor } from "./components/ExceptionEditor";
import { ScheduleSettings } from "./components/ScheduleSettings";
import { ScheduleTable } from "./components/ScheduleTable";
import { Statistics } from "./components/Statistics";
import { WarningPanel } from "./components/WarningPanel";
import { copyScheduleToClipboard, downloadSchedulePdf } from "./services/export";
import { optimizeSchedule } from "./services/optimizer";
import { LocalStorageProvider } from "./services/storage";
import type { ExcludedDate, PersistedState, ScheduleSettings as Settings, Student } from "./types";
import { formatLongDate } from "./utils/dates";
import { activeSlotCount, filledSlotCount, generateSchedule } from "./utils/schedule";

const storage = new LocalStorageProvider();
const defaultState: PersistedState = {
  version: 1,
  settings: {
    className: "",
    startDate: "2026-08-24",
    endDate: "2027-07-19",
    cleaningWeekdays: [3, 5],
    studentsPerCleaningDay: 1,
  },
  students: [],
  excludedDates: [],
  schedule: [],
};

export default function App() {
  const [state, setState] = useState<PersistedState>(defaultState);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [exportMessage, setExportMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.load().then((saved) => {
      if (saved) setState(saved);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) void storage.save(state);
  }, [ready, state]);

  const activeSlots = activeSlotCount(state.schedule);
  const filledSlots = filledSlotCount(state.schedule);
  const average = state.students.length ? filledSlots / state.students.length : 0;
  const periodLabel = state.settings.startDate && state.settings.endDate
    ? `${formatLongDate(state.settings.startDate)} – ${formatLongDate(state.settings.endDate)}`
    : "Periode nog niet ingesteld";

  const validationWarnings = useMemo(() => {
    const issues: string[] = [];
    if (state.settings.endDate < state.settings.startDate) issues.push("De einddatum moet na de startdatum liggen.");
    if (state.settings.cleaningWeekdays.length === 0) issues.push("Kies minimaal één poetsdag.");
    if (state.students.length === 0) issues.push("Voeg minimaal één leerling toe.");
    const names = state.students.map((student) => student.name.trim().toLocaleLowerCase("nl")).filter(Boolean);
    if (new Set(names).size !== names.length) issues.push("Iedere leerling moet een unieke naam hebben.");
    const unavailable = state.students.filter(
      (student) => !student.availableWeekdays.some((day) => state.settings.cleaningWeekdays.includes(day)),
    );
    if (unavailable.length) issues.push(`${unavailable.length} leerling(en) zijn op geen enkele poetsdag beschikbaar.`);
    return issues;
  }, [state.settings, state.students]);

  const updateSettings = (settings: Settings) => setState((current) => ({ ...current, settings }));

  const updateStudents = (students: Student[]) => setState((current) => ({ ...current, students }));

  const removeStudent = (studentId: string) => {
    const student = state.students.find((item) => item.id === studentId);
    if (!window.confirm(`${student?.name || "Deze leerling"} verwijderen? Toewijzingen worden ook gewist.`)) return;
    setState((current) => ({
      ...current,
      students: current.students.filter((item) => item.id !== studentId),
      schedule: current.schedule.map((day) => ({
        ...day,
        assignments: day.assignments.map((assignment) =>
          assignment.studentId === studentId
            ? { studentId: null, locked: false, source: null }
            : assignment,
        ),
      })),
    }));
  };

  const generate = () => {
    const blocking = validationWarnings.filter((warning) =>
      warning.startsWith("De einddatum") || warning.startsWith("Kies minimaal"),
    );
    if (blocking.length) {
      setWarnings(blocking);
      return;
    }
    setState((current) => ({
      ...current,
      schedule: generateSchedule(current.settings, current.excludedDates, current.schedule),
    }));
    setWarnings([]);
  };

  const updateExclusions = (excludedDates: ExcludedDate[]) => {
    setState((current) => ({
      ...current,
      excludedDates,
      schedule: generateSchedule(current.settings, excludedDates, current.schedule),
    }));
  };

  const optimize = () => {
    const blockingWarnings = validationWarnings.filter((warning) =>
      warning.startsWith("De einddatum") ||
      warning.startsWith("Kies minimaal") ||
      warning.startsWith("Voeg minimaal"),
    );
    if (blockingWarnings.length || state.schedule.length === 0) {
      setWarnings(state.schedule.length === 0 ? ["Genereer eerst de poetsdagen.", ...blockingWarnings] : blockingWarnings);
      return;
    }
    const result = optimizeSchedule(state.students, state.schedule);
    setState((current) => ({ ...current, schedule: result.schedule }));
    setWarnings([...new Set([...validationWarnings, ...result.warnings])]);
  };

  const assign = (date: string, slot: number, studentId: string | null) => {
    const day = state.schedule.find((item) => item.date === date);
    const student = state.students.find((item) => item.id === studentId);
    if (student && day && !student.availableWeekdays.includes(day.weekday)) {
      const accepted = window.confirm(
        `${student.name} staat niet als beschikbaar op deze weekdag. Toch toewijzen en vastzetten?`,
      );
      if (!accepted) return;
    }
    if (studentId && day?.assignments.some((item, index) => index !== slot && item.studentId === studentId)) {
      window.alert("Een leerling kan niet twee keer op hetzelfde poetsmoment staan.");
      return;
    }
    setState((current) => ({
      ...current,
      schedule: current.schedule.map((item) => item.date !== date ? item : {
        ...item,
        assignments: item.assignments.map((assignment, index) => index !== slot ? assignment : {
          studentId,
          locked: Boolean(studentId),
          source: studentId ? "manual" : null,
        }),
      }),
    }));
  };

  const unlock = (date: string, slot: number) => {
    setState((current) => ({
      ...current,
      schedule: current.schedule.map((day) => day.date !== date ? day : {
        ...day,
        assignments: day.assignments.map((assignment, index) =>
          index === slot ? { ...assignment, locked: false, source: assignment.studentId ? "optimizer" : null } : assignment,
        ),
      }),
    }));
  };

  const clearAutomatic = () => {
    if (!window.confirm("Alle automatische toewijzingen wissen? Vastgezette keuzes blijven staan.")) return;
    setState((current) => ({
      ...current,
      schedule: current.schedule.map((day) => ({
        ...day,
        assignments: day.assignments.map((assignment) => assignment.locked
          ? assignment
          : { studentId: null, locked: false, source: null }),
      })),
    }));
    setWarnings([]);
  };

  const reset = async () => {
    if (!window.confirm("Alles wissen en opnieuw beginnen? Dit kan niet ongedaan worden gemaakt.")) return;
    await storage.clear();
    setState(defaultState);
    setWarnings([]);
  };

  const copySchedule = async () => {
    try {
      await copyScheduleToClipboard(state.schedule, state.students, state.settings.cleaningWeekdays);
      setExportMessage("Rooster gekopieerd");
    } catch {
      setExportMessage("Kopiëren mislukt");
    }
    window.setTimeout(() => setExportMessage(""), 2500);
  };

  const downloadPdf = async () => {
    setExportMessage("PDF maken…");
    try {
      await downloadSchedulePdf(state.settings, state.schedule, state.students);
      setExportMessage("PDF gedownload");
    } catch {
      setExportMessage("PDF maken mislukt");
    }
    window.setTimeout(() => setExportMessage(""), 2500);
  };

  if (!ready) return <div className="loading">Rooster laden…</div>;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-mark" aria-hidden="true">P</div>
        <div>
          <p className="eyebrow">Eerlijk verdeeld, rustig geregeld</p>
          <h1>{state.settings.className || "Poetsrooster"}</h1>
          <p className="print-period">{periodLabel}</p>
        </div>
        <div className="header-actions no-print">
          {exportMessage && <span className="export-status" role="status">{exportMessage}</span>}
          <button
            className="button ghost"
            type="button"
            disabled={state.schedule.length === 0}
            onClick={() => void copySchedule()}
          >
            Rooster kopiëren
          </button>
          <button
            className="button ghost"
            type="button"
            disabled={state.schedule.length === 0}
            onClick={() => void downloadPdf()}
          >
            PDF downloaden
          </button>
          <button className="button ghost" type="button" onClick={() => window.print()}>Printen</button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar no-print">
          <ScheduleSettings settings={state.settings} onChange={updateSettings} onGenerate={generate} />
          <ClassEditor
            students={state.students}
            weekdays={state.settings.cleaningWeekdays}
            onChange={updateStudents}
            onRemove={removeStudent}
          />
          <ExceptionEditor
            exclusions={state.excludedDates}
            minDate={state.settings.startDate}
            maxDate={state.settings.endDate}
            onChange={updateExclusions}
          />
          <button className="reset-button" type="button" onClick={reset}>Alles wissen / reset</button>
        </aside>

        <div className="content">
          <section className="schedule-card">
            <div className="schedule-toolbar no-print">
              <div>
                <span className="eyebrow">Schooljaar</span>
                <h2>Rooster</h2>
                <p>{periodLabel}</p>
              </div>
              <div className="toolbar-actions">
                <button className="button ghost" type="button" onClick={clearAutomatic}>Automatische toewijzingen wissen</button>
                <button className="button primary" type="button" onClick={optimize}>Optimale verdeling</button>
              </div>
            </div>

            <div className="status-strip no-print" aria-label="Roosterstatus">
              <div><strong>{activeSlots}</strong><span>poetsbeurten</span></div>
              <div><strong>{filledSlots}</strong><span>ingevuld</span></div>
              <div><strong>{state.students.length}</strong><span>leerlingen</span></div>
              <div><strong>{average.toLocaleString("nl-NL", { maximumFractionDigits: 2 })}</strong><span>gemiddeld</span></div>
            </div>
            <div className="no-print"><WarningPanel warnings={warnings} /></div>
            <ScheduleTable
              schedule={state.schedule}
              students={state.students}
              weekdays={state.settings.cleaningWeekdays}
              onAssign={assign}
              onUnlock={unlock}
            />
          </section>
          <Statistics students={state.students} schedule={state.schedule} weekdays={state.settings.cleaningWeekdays} />
        </div>
      </main>
    </div>
  );
}
