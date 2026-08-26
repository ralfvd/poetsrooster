export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Student = {
  id: string;
  name: string;
  previousYearCount: number;
  manualOnly: boolean;
  availableWeekdays: Weekday[];
};

export type ScheduleSettings = {
  className: string;
  startDate: string;
  endDate: string;
  cleaningWeekdays: Weekday[];
  studentsPerCleaningDay: number;
};

export type ExcludedDate = {
  id: string;
  date: string;
  reason: string;
};

export type SchoolExceptionFile = {
  version: 1;
  updatedAt: string | null;
  exceptions: ExcludedDate[];
};

export type Assignment = {
  studentId: string | null;
  locked: boolean;
  source: "manual" | "optimizer" | null;
  changedFromStudentId?: string | null;
};

export type ScheduleDay = {
  date: string;
  weekday: Weekday;
  excluded: boolean;
  exclusionReason?: string;
  unavailableStudentIds?: string[];
  assignments: Assignment[];
};

export type PersistedState = {
  version: 1;
  settings: ScheduleSettings;
  students: Student[];
  excludedDates: ExcludedDate[];
  schedule: ScheduleDay[];
};

export type RosterBackupFile = {
  format: "poetsrooster-backup";
  version: 1;
  exportedAt: string;
  state: PersistedState;
};

export type OptimizerResult = {
  schedule: ScheduleDay[];
  warnings: string[];
};

export type StudentStatistic = {
  student: Student;
  currentYearCount: number;
  totalCount: number;
  weekdayCounts: Record<number, number>;
  minimumIntervalWeeks: number | null;
  averageIntervalWeeks: number | null;
  maximumIntervalWeeks: number | null;
};
