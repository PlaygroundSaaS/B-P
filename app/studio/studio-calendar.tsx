'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, day, type CalendarItem } from '@/lib/operations-model';
import { calendarGroup, calendarGroups, itemsByDate, monthDays, openingDay, sameDayIn, shiftMonth, weekdayIndex } from '@/lib/studio-calendar';
import { Status, type OpenRecord } from './ops-ui';
import styles from './studio-calendar.module.css';

type Props = { items: CalendarItem[]; open: OpenRecord; today?: string };
const format = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
// Built from parts so the label reads the same whatever date formatting the browser or server ships with.
const longDate = (date: string) => `${format(date, { weekday: 'long' })} ${format(date, { day: 'numeric', month: 'long', year: 'numeric' })}`;
const scheduled = (count: number) => count ? `${count} scheduled ${count === 1 ? 'item' : 'items'}` : 'Nothing scheduled';
const keyMoves: Record<string, (date: string) => string> = {
  ArrowLeft: d => addDays(d, -1), ArrowRight: d => addDays(d, 1), ArrowUp: d => addDays(d, -7), ArrowDown: d => addDays(d, 7),
  Home: d => addDays(d, -weekdayIndex(d)), End: d => addDays(d, 6 - weekdayIndex(d)),
  PageUp: d => sameDayIn(d, shiftMonth(d.slice(0, 7), -1)), PageDown: d => sameDayIn(d, shiftMonth(d.slice(0, 7), 1)),
};

export default function StudioCalendar({ items, open, today = day() }: Props) {
  const dates = useMemo(() => itemsByDate(items), [items]);
  const [selected, setSelected] = useState(today); const [month, setMonth] = useState(today.slice(0, 7));
  const grid = useRef<HTMLDivElement>(null); const focusSelected = useRef(false);
  useEffect(() => { if (!focusSelected.current) return; focusSelected.current = false; grid.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus(); }, [selected]);
  const select = (date: string, focus = false) => { focusSelected.current = focus; setSelected(date); setMonth(date.slice(0, 7)); };
  const showMonth = (next: string) => { setMonth(next); setSelected(openingDay(next, today, dates)); };
  const dayItems = dates.get(selected) || [];
  const nextItem = dayItems.length ? undefined : items.find(i => i.date > selected);
  const monthTitle = format(`${month}-01`, { month: 'long', year: 'numeric' });
  return <div className={styles.wrap}><div className={styles.calendar}>
    <section className={`ops-panel ${styles.month}`} aria-label={`Calendar for ${monthTitle}`}>
      <header className={styles.header}>
        <div><h2>{monthTitle}</h2><p>{scheduled(items.filter(i => i.date.startsWith(`${month}-`)).length)} this month</p></div>
        <div className={styles.nav}>
          <button type="button" aria-label="Previous month" onClick={() => showMonth(shiftMonth(month, -1))}>‹</button>
          <button type="button" onClick={() => select(today)}>Today</button>
          <button type="button" aria-label="Next month" onClick={() => showMonth(shiftMonth(month, 1))}>›</button>
        </div>
      </header>
      <div className={styles.weekdays} aria-hidden="true">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <span key={d}>{d}</span>)}</div>
      <div className={styles.grid} ref={grid} role="group" aria-label={`Days in ${monthTitle}. Use the arrow keys to move between days.`}>
        {monthDays(month).map(date => {
          const list = dates.get(date) || [];
          const classes = [styles.day, !date.startsWith(`${month}-`) && styles.outside, date < today && styles.past, date === today && styles.today, date === selected && styles.selected].filter(Boolean).join(' ');
          return <button type="button" key={date} data-date={date} className={classes} tabIndex={date === selected ? 0 : -1} aria-pressed={date === selected}
            aria-label={`${longDate(date)}${date === today ? ', today' : ''}: ${scheduled(list.length).toLowerCase()}`}
            onClick={() => select(date)} onKeyDown={e => { const move = keyMoves[e.key]; if (!move) return; e.preventDefault(); select(move(date), true); }}>
            <span className={styles.number}>{Number(date.slice(8))}</span>
            {list.length > 0 && <span className={styles.entries} aria-hidden="true">
              {list.slice(0, 3).map(i => <span key={`${i.kind}-${i.id}`} className={styles.entry} data-group={calendarGroup(i.kind)}>{i.time && <time>{i.time}</time>}{i.title}</span>)}
              {list.length > 3 && <span className={styles.more}>+{list.length - 3} more</span>}
            </span>}
            {list.length > 0 && <span className={styles.dots} aria-hidden="true">{list.slice(0, 4).map(i => <span key={`${i.kind}-${i.id}`} data-group={calendarGroup(i.kind)} />)}</span>}
          </button>;
        })}
      </div>
      <ul className={styles.legend} aria-label="Colour key">{calendarGroups.map(g => <li key={g.id} data-group={g.id}>{g.label}</li>)}</ul>
    </section>
    <section className={`ops-panel ${styles.agenda}`} aria-labelledby="studio-calendar-day">
      <p className="eyebrow">{selected === today ? 'TODAY' : format(selected, { weekday: 'long' }).toUpperCase()}</p>
      <h2 id="studio-calendar-day">{format(selected, { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
      {dayItems.length ? <ol className={styles.items}>{dayItems.map(i => <li key={`${i.kind}-${i.id}`}>
        <button type="button" className={styles.item} data-group={calendarGroup(i.kind)} onClick={() => open(i.tab, i.recordId)}>
          <time>{i.time || 'All day'}</time><span><Status>{i.kind}</Status><b>{i.title}</b></span><span className={styles.open} aria-hidden="true">Open →</span>
        </button>
      </li>)}</ol> : <div className={styles.empty}>
        <p>Nothing scheduled for this day.</p>
        {nextItem && <button type="button" onClick={() => select(nextItem.date)}>Next: {format(nextItem.date, { weekday: 'short' })} {format(nextItem.date, { day: 'numeric', month: 'long' })} · {nextItem.title} →</button>}
      </div>}
    </section>
  </div></div>;
}
