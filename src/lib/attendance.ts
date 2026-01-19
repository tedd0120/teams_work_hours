import dayjs from "dayjs";

export const INSUFFICIENT_HOURS_THRESHOLD = 10.5;

export type RawCalendarItem = {
  attDate: string;
  isrest: number;
  firstDate?: string | null;
  endDate?: string | null;
  exp?: string | null;
  resultList?: Array<string | number | null>;
};

export type AttendanceRecord = {
  date: string;
  month: string;
  isRest: number;
  firstDate: string | null;
  endDate: string | null;
  remark: string | null;
  remark2: string | null;
  workHours: number;
  effectiveWorkday: number;
  missingClock: boolean;
};

export type AttendanceSummary = {
  validDays: number;
  validHours: number;
  avgHours: number | null;
};

const LATE = "迟到";
const EARLY = "早退";
const SICK_LEAVE = "病假";
const ANNUAL_LEAVE = "年假";
const COMP_LEAVE = "调休假";
const HALF_DAY = "半天";

export function nextMonth(ym: string): string {
  return dayjs(`${ym}-01`).add(1, "month").format("YYYY-MM");
}

export function buildAttendanceRecords(
  items: RawCalendarItem[],
  checkMonth: string
): AttendanceRecord[] {
  const mapped = items.map((item) => {
    const remark2 =
      item.resultList && item.resultList.length > 0
        ? String(item.resultList[0])
        : null;
    const record: AttendanceRecord = {
      date: item.attDate,
      month: item.attDate?.slice(0, 7) ?? "",
      isRest: item.isrest,
      firstDate: item.firstDate ?? null,
      endDate: item.endDate ?? null,
      remark: item.exp ?? null,
      remark2,
      workHours: 0,
      effectiveWorkday: 0,
      missingClock: false
    };

    const { workHours, missingClock } = calculateWorkHours(
      record.firstDate,
      record.endDate,
      record.isRest
    );
    record.workHours = workHours;
    record.missingClock = missingClock;
    record.effectiveWorkday = calculateEffectiveWorkday(record);
    return record;
  });

  const filtered = mapped.filter((record) => record.month === checkMonth);
  const seen = new Set<string>();
  const deduped: AttendanceRecord[] = [];
  for (const record of filtered) {
    if (seen.has(record.date)) {
      continue;
    }
    seen.add(record.date);
    deduped.push(record);
  }

  return deduped;
}

export function calculateWorkHours(
  firstDate: string | null,
  endDate: string | null,
  isRest: number
): { workHours: number; missingClock: boolean } {
  if (isRest !== 0) {
    return { workHours: 0, missingClock: false };
  }

  const startValid = isValidDateTime(firstDate);
  const endValid = isValidDateTime(endDate);

  if (!startValid || !endValid) {
    return { workHours: 0, missingClock: true };
  }

  const start = dayjs(firstDate as string);
  const end = dayjs(endDate as string);
  const diffHours = (end.valueOf() - start.valueOf()) / 3600000;

  return { workHours: diffHours, missingClock: false };
}

export function calculateEffectiveWorkday(record: {
  isRest: number;
  remark: string | null;
  remark2: string | null;
  workHours: number;
}): number {
  if (record.isRest !== 0) {
    return 0;
  }

  const remark = record.remark;
  if (!remark || remark === LATE || remark === EARLY) {
    return 1;
  }

  if (remark === SICK_LEAVE || remark === ANNUAL_LEAVE || remark === COMP_LEAVE) {
    return record.workHours > 0 ? 0.5 : 0;
  }

  if (record.remark2 && record.remark2.includes(HALF_DAY)) {
    return 0.5;
  }

  return 0;
}

export function calculateSummary(records: AttendanceRecord[]): AttendanceSummary {
  const today = dayjs().format("YYYY-MM-DD");
  const eligible = records.filter((record) => record.date < today);
  const validDays = eligible.reduce((sum, record) => sum + record.effectiveWorkday, 0);
  const validHours = eligible.reduce((sum, record) => sum + record.workHours, 0);
  const avgHours = validDays > 0 ? roundTo2(validHours / validDays) : null;

  return {
    validDays,
    validHours,
    avgHours
  };
}

export function isInsufficientHours(record: AttendanceRecord): boolean {
  if (record.isRest !== 0 || record.missingClock) {
    return false;
  }
  return record.workHours <= INSUFFICIENT_HOURS_THRESHOLD;
}

export function formatHours(value: number): string {
  return roundTo2(value).toFixed(2);
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isValidDateTime(value: string | null): boolean {
  if (!value) {
    return false;
  }
  return dayjs(value).isValid();
}
