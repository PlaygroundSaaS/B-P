import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
function load(path, mocks = {}) {
  const filename = resolve(root, path);
  const source = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', source)(module, module.exports, name => name in mocks ? mocks[name] : name.startsWith('@/') ? load(name.slice(2) + '.ts', mocks) : name.startsWith('.') ? load(resolve(dirname(filename), name) + '.ts', mocks) : require(name));
  return module.exports;
}
const calendar = load('lib/studio-calendar.ts');
const { calendarGroup, monthDays, sameDayIn, shiftMonth, itemsByDate, openingDay } = calendar;
const styles = new Proxy({}, { get: (_, key) => key === '__esModule' ? true : key === 'default' ? styles : String(key) });
const { default: StudioCalendar } = load('app/studio/studio-calendar.tsx', { '@/lib/studio-calendar': calendar, './ops-ui': { Status: ({ children }) => createElement('span', { className: 'ops-status' }, children) }, './studio-calendar.module.css': styles });
const item = (date, title, kind = 'Task', time = '') => ({ id: `${kind}-${date}-${title}`, date, time, title, kind, tab: 'tasks', recordId: title });
const render = (items, today = '2026-09-25') => renderToStaticMarkup(createElement(StudioCalendar, { items, open() {}, today }));

test('month grids run Monday to Sunday and cover the whole month', () => {
  const september = monthDays('2026-09');
  assert.equal(september.length, 35); assert.equal(september[0], '2026-08-31'); assert.equal(september.at(-1), '2026-10-04');
  assert.deepEqual([monthDays('2027-02')[0], monthDays('2027-02').length], ['2027-02-01', 28]);
  assert.deepEqual([monthDays('2026-03')[0], monthDays('2026-03').length], ['2026-02-23', 42]);
});
test('moving between months keeps the day where it can and crosses years', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(sameDayIn('2026-01-31', '2026-02'), '2026-02-28'); assert.equal(sameDayIn('2028-03-30', '2028-02'), '2028-02-29'); assert.equal(sameDayIn('2026-09-05', '2026-10'), '2026-10-05');
});
test('a new month opens on today, else its first busy day, else the 1st', () => {
  const dates = itemsByDate([item('2026-10-14', 'Order ribbon'), item('2026-10-09', 'Call venue')]);
  assert.equal(openingDay('2026-09', '2026-09-25', dates), '2026-09-25');
  assert.equal(openingDay('2026-10', '2026-09-25', dates), '2026-10-09');
  assert.equal(openingDay('2026-11', '2026-09-25', dates), '2026-11-01');
});
test('every calendar kind has a colour group', () => {
  assert.deepEqual(['Wedding', 'Funeral', 'Corporate', 'Consultation', 'Delivery', 'Collection', 'Supplier delivery', 'Recurring flowers', 'Production', 'Payment due', 'Payment stage', 'Task', 'Follow-up'].map(calendarGroup),
    ['event', 'event', 'event', 'consultation', 'delivery', 'delivery', 'delivery', 'delivery', 'production', 'payment', 'payment', 'task', 'task']);
});
test('the calendar shows the month, today, and today’s items in the day panel', () => {
  const html = render([item('2026-09-25', 'Harper wedding', 'Wedding', '13:00'), item('2026-09-25', 'Order ribbon'), item('2026-09-26', 'Hall delivery', 'Delivery', '09:00')]);
  assert.match(html, /<h2>September 2026<\/h2>/);
  assert.match(html, /3 scheduled items this month/);
  assert.match(html, /aria-label="Friday 25 September 2026, today: 2 scheduled items"/);
  assert.match(html, /data-date="2026-09-25" class="day today selected" tabindex="0" aria-pressed="true"/);
  const panel = html.split('class="ops-panel agenda"')[1];
  assert.match(panel, /Harper wedding/); assert.match(panel, /Order ribbon/); assert.match(panel, /All day/); assert.doesNotMatch(panel, /Hall delivery/);
  assert.equal((html.match(/tabindex="0"/g) || []).length, 1);
});
test('busy days show three items and a count of the rest, and quiet days point to what is next', () => {
  const busy = ['A', 'B', 'C', 'D', 'E'].map(title => item('2026-09-25', title));
  const html = render([...busy, item('2026-10-02', 'Collect vases', 'Collection')], '2026-09-24');
  const cell = html.split('data-date="2026-09-25"')[1].split('</button>')[0];
  assert.match(cell, /\+2 more/); assert.doesNotMatch(cell, />D</);
  assert.match(html, /Nothing scheduled for this day/); assert.match(html, /Next: Fri 25 September · A →/);
  assert.match(html, /data-date="2026-10-02" class="day outside"/);
});
