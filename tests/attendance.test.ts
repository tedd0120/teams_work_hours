import assert from "node:assert/strict";
import test from "node:test";
import dayjs from "dayjs";

import {
  AttendanceRecord,
  buildAttendanceRecords,
  calculateEffectiveWorkday,
  calculateSummary,
  calculateWorkHours,
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
