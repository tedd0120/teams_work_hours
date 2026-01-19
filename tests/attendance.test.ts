import assert from "node:assert/strict";
import test from "node:test";
import dayjs from "dayjs";

import {
  AttendanceRecord,
  buildAttendanceRecords,
  buildDailyAverage,
  buildMonthlyAverage,
  calculateEffectiveWorkday,
  calculateSummary,
  calculateWorkHours,
  getRecentMonths,
  getMonthsBetween,
  isInsufficientHours,
  nextMonth
} from "../src/lib/attendance";

test("nextMonth returns the following month", () => {
  assert.equal(nextMonth("2026-01"), "2026-02");
});

test("calculateWorkHours returns 0 when clock is invalid", () => {
  const result = calculateWorkHours(null, "2026-01-01 18:00:00", 0);
  assert.equal(result.workHours, 0);
  assert.equal(result.missingClock, true);
});

test("calculateWorkHours uses zero for holidays", () => {
  const result = calculateWorkHours("2026-01-01 09:00:00", "2026-01-01 18:00:00", 1);
  assert.equal(result.workHours, 0);
  assert.equal(result.missingClock, false);
});

test("calculateEffectiveWorkday follows remark rules", () => {
  const base = {
    isRest: 0,
    remark: null,
    remark2: null,
    workHours: 8
  };
  assert.equal(calculateEffectiveWorkday(base), 1);
  assert.equal(
    calculateEffectiveWorkday({ ...base, remark: "病假", workHours: 4 }),
    0.5
  );
  assert.equal(
    calculateEffectiveWorkday({ ...base, remark: "病假", workHours: 0 }),
    0
  );
  assert.equal(
    calculateEffectiveWorkday({ ...base, remark: "其他", remark2: "半天事由" }),
    0.5
  );
});

test("buildAttendanceRecords maps and de-duplicates", () => {
  const records = buildAttendanceRecords(
    [
      {
        attDate: "2026-01-01",
        isrest: 0,
        firstDate: "2026-01-01 09:00:00",
        endDate: "2026-01-01 18:00:00",
        exp: null,
        resultList: []
      },
      {
        attDate: "2026-01-01",
        isrest: 0
      },
      {
        attDate: "2026-02-01",
        isrest: 0
      }
    ],
    "2026-01"
  );
  assert.equal(records.length, 1);
  assert.equal(records[0]?.date, "2026-01-01");
});

test("calculateSummary excludes today and handles avg", () => {
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  const today = dayjs().format("YYYY-MM-DD");
  const records: AttendanceRecord[] = [
    {
      date: yesterday,
      month: yesterday.slice(0, 7),
      isRest: 0,
      firstDate: "2026-01-01 09:00:00",
      endDate: "2026-01-01 18:00:00",
      remark: null,
      remark2: null,
      workHours: 9,
      effectiveWorkday: 1,
      missingClock: false
    },
    {
      date: today,
      month: today.slice(0, 7),
      isRest: 0,
      firstDate: "2026-01-02 09:00:00",
      endDate: "2026-01-02 18:00:00",
      remark: null,
      remark2: null,
      workHours: 9,
      effectiveWorkday: 1,
      missingClock: false
    }
  ];
  const summary = calculateSummary(records);
  assert.equal(summary.validDays, 1);
  assert.equal(summary.validHours, 9);
  assert.equal(summary.avgHours, 9);
});

test("getRecentMonths returns the expected range", () => {
  const months = getRecentMonths(3);
  assert.equal(months.length, 3);
  assert.ok(months[0] < months[1]);
});

test("getMonthsBetween returns inclusive months", () => {
  const months = getMonthsBetween("2026-01", "2026-03");
  assert.deepEqual(months, ["2026-01", "2026-02", "2026-03"]);
});

test("buildMonthlyAverage returns averages per month", () => {
  const date = dayjs().subtract(1, "day");
  const month = date.format("YYYY-MM");
  const dateStr = date.format("YYYY-MM-DD");
  const records: AttendanceRecord[] = [
    {
      date: dateStr,
      month,
      isRest: 0,
      firstDate: `${dateStr} 09:00:00`,
      endDate: `${dateStr} 18:00:00`,
      remark: null,
      remark2: null,
      workHours: 9,
      effectiveWorkday: 1,
      missingClock: false
    }
  ];
  const points = buildMonthlyAverage(records, [month]);
  assert.equal(points.length, 1);
  assert.equal(points[0]?.value, 9);
});

test("buildDailyAverage skips zero workdays and marks half-day", () => {
  const date = dayjs().subtract(1, "day");
  const dateStr = date.format("YYYY-MM-DD");
  const month = date.format("YYYY-MM");
  const prevDate = date.subtract(1, "day").format("YYYY-MM-DD");
  const records: AttendanceRecord[] = [
    {
      date: dateStr,
      month,
      isRest: 0,
      firstDate: `${dateStr} 09:00:00`,
      endDate: `${dateStr} 13:00:00`,
      remark: null,
      remark2: null,
      workHours: 4,
      effectiveWorkday: 0.5,
      missingClock: false
    },
    {
      date: prevDate,
      month,
      isRest: 0,
      firstDate: null,
      endDate: null,
      remark: null,
      remark2: null,
      workHours: 0,
      effectiveWorkday: 0,
      missingClock: true
    }
  ];
  const points = buildDailyAverage(records, month);
  assert.equal(points.length, 1);
  assert.equal(points[0]?.value, 8);
  assert.equal(points[0]?.isHalfDay, true);
});

test("isInsufficientHours flags low hours", () => {
  const record: AttendanceRecord = {
    date: "2026-01-01",
    month: "2026-01",
    isRest: 0,
    firstDate: "2026-01-01 09:00:00",
    endDate: "2026-01-01 18:00:00",
    remark: null,
    remark2: null,
    workHours: 10.5,
    effectiveWorkday: 1,
    missingClock: false
  };
  assert.equal(isInsufficientHours(record), true);
});
