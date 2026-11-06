import assert from 'node:assert/strict';
import { calendarMonthDays, dateInZone } from '../design/calendar-rules.js';

const key = date => `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
const october = calendarMonthDays(2026, 10);
assert.equal(october.length, 35);
assert.equal(key(october[0]), '2026-09-28');
assert.equal(key(october.at(-1)), '2026-11-01');
assert.equal(october.filter(date => date.month === 10).length, 31);

const leap = calendarMonthDays(2024, 2);
assert.equal(leap.filter(date => date.month === 2).length, 29);
assert.ok(leap.some(date => key(date) === '2024-02-29'));
assert.equal(calendarMonthDays(2025, 2).filter(date => date.month === 2).length, 28);
assert.equal(key(calendarMonthDays(2025, 12).at(-1)), '2026-01-04');
assert.equal(key(calendarMonthDays(2026, 1)[0]), '2025-12-29');

// 连续 30 年所有月份：日期唯一、完整、不漏日，且始终从周一到周日。
for (let year = 2010; year <= 2039; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    const days = calendarMonthDays(year, month);
    assert.equal(days.length % 7, 0);
    assert.ok(days.length >= 28 && days.length <= 42);
    assert.equal(new Set(days.map(key)).size, days.length);
    assert.equal(new Date(`${key(days[0])}T00:00:00Z`).getUTCDay(), 1);
    assert.equal(new Date(`${key(days.at(-1))}T00:00:00Z`).getUTCDay(), 0);
    const current = days.filter(date => date.year === year && date.month === month);
    assert.equal(current[0].day, 1);
    assert.equal(current.length, new Date(Date.UTC(year, month, 0)).getUTCDate());
    for (let index = 1; index < days.length; index += 1) {
      assert.equal(Date.parse(`${key(days[index])}T00:00:00Z`) - Date.parse(`${key(days[index - 1])}T00:00:00Z`), 86400000);
    }
  }
}

// 回到今天的月份与标签使用电脑时区；同一瞬间可能跨年。
assert.deepEqual(dateInZone('2026-12-31T15:30:00Z', 'Asia/Shanghai'), { year: 2026, month: 12, day: 31 });
assert.deepEqual(dateInZone('2026-12-31T15:30:00Z', 'Asia/Tokyo'), { year: 2027, month: 1, day: 1 });
assert.equal(calendarMonthDays(1, 1).find(date => date.month === 1).year, 1);
assert.equal(calendarMonthDays(9999, 12).filter(date => date.month === 12).length, 31);
console.log('PASS: month grid, leap years, year boundaries, 360 months, system-zone date');
