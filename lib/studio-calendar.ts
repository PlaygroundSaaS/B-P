import { addDays, type CalendarItem } from './operations-model';

export type CalendarGroup = 'event' | 'consultation' | 'delivery' | 'production' | 'payment' | 'task';
export const calendarGroups: { id: CalendarGroup; label: string }[] = [{ id: 'event', label: 'Events' }, { id: 'consultation', label: 'Consultations' }, { id: 'delivery', label: 'Deliveries & collections' }, { id: 'production', label: 'Production' }, { id: 'payment', label: 'Payments' }, { id: 'task', label: 'Tasks & follow-ups' }];
const groupByKind: Record<string, CalendarGroup> = { Consultation: 'consultation', Delivery: 'delivery', Collection: 'delivery', 'Supplier delivery': 'delivery', 'Recurring flowers': 'delivery', Production: 'production', 'Payment due': 'payment', 'Payment stage': 'payment', Task: 'task', 'Follow-up': 'task' };
/** Wedding, Funeral and Corporate plans all read as events; everything else is grouped by what it asks of the studio. */
export const calendarGroup = (kind: string): CalendarGroup => groupByKind[kind] || 'event';

/** Monday of the week is 0, Sunday is 6. */
export const weekdayIndex = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
export const monthLength = (month: string) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
export const shiftMonth = (month: string, amount: number) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + amount, 1)).toISOString().slice(0, 7);
/** The same day number in another month, pulled back to that month's last day when it is shorter. */
export const sameDayIn = (date: string, month: string) => `${month}-${String(Math.min(Number(date.slice(8, 10)), monthLength(month))).padStart(2, '0')}`;
/** Every date shown on a month grid: whole Monday-to-Sunday weeks covering the month. */
export function monthDays(month: string) {
  const first = `${month}-01`; const offset = weekdayIndex(first);
  return Array.from({ length: Math.ceil((offset + monthLength(month)) / 7) * 7 }, (_, i) => addDays(first, i - offset));
}
export function itemsByDate(items: CalendarItem[]) {
  const dates = new Map<string, CalendarItem[]>();
  for (const item of items) dates.set(item.date, [...(dates.get(item.date) || []), item]);
  return dates;
}
/** When moving to a month, land on today if it is in view, otherwise the first day with something scheduled. */
export function openingDay(month: string, today: string, dates: Map<string, CalendarItem[]>) {
  if (today.startsWith(month)) return today;
  return [...dates.keys()].filter(date => date.startsWith(`${month}-`)).sort()[0] || `${month}-01`;
}
