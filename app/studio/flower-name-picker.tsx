'use client';
import { useId, useRef, useState } from 'react';
import catalogue from '@/lib/flowervision-catalogue.json';
import styles from './flower-name-picker.module.css';
export type CatalogueFlower = (typeof catalogue.flowers)[number];
const aliases: Record<string, string[]> = { rose: ['rose', 'rosa'], roses: ['rose', 'rosa'], lily: ['lily', 'lilium', 'lili'], lilies: ['lily', 'lilium', 'lili'], chrysanthemum: ['chrysanthemum', 'chr '], chrysanthemums: ['chrysanthemum', 'chr '], carnation: ['carnation', 'dianth'], carnations: ['carnation', 'dianth'], lisianthus: ['lisianthus', 'eust'], alstroemeria: ['alstro'], hydrangea: ['hydrangea', 'hydr'] };
const byName = new Map(catalogue.flowers.map(flower => [flower.name.toLocaleLowerCase(), flower]));
export function findCatalogueFlower(name: string) { return byName.get(name.trim().toLocaleLowerCase()); }
export function FlowerThumbnail({ flower }: { flower?: CatalogueFlower }) {
  const [failed, setFailed] = useState(false);
  return <span className={styles.thumbnail}>{flower?.imageUrl && !failed ? <img src={flower.imageUrl} alt="" width={44} height={44} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span aria-hidden="true">✿</span>}</span>;
}
export default function FlowerNamePicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const id = useId(); const input = useRef<HTMLInputElement>(null); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1);
  const terms = value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = catalogue.flowers.filter(flower => terms.every(term => (aliases[term] || [term]).some(word => `${flower.name} ${flower.colour}`.toLocaleLowerCase().includes(word))));
  function choose(flower: CatalogueFlower) { onChange(flower.name); input.current?.focus(); setOpen(false); setActive(-1); }
  function move(index: number) { setActive(index); document.getElementById(`${id}-${index}`)?.scrollIntoView({ block: 'nearest' }); }
  return <div className={styles.picker} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setActive(-1); } }}>
    <label htmlFor={id}>Flower name</label>
    <div className={styles.inputRow}><input ref={input} id={id} name="name" value={value} required maxLength={160} autoComplete="off" placeholder="Search flowers or type your own" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined} onFocus={() => setOpen(true)} onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }} onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActive(-1); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); if (matches.length) move(event.key === 'ArrowDown' ? Math.min(active + 1, matches.length - 1) : Math.max(active - 1, 0)); }
      if (event.key === 'Enter' && open && active >= 0 && matches[active]) { event.preventDefault(); choose(matches[active]); }
    }} /><button type="button" className={styles.toggle} aria-label="Browse flower names" aria-expanded={open} onClick={() => { setOpen(!open); setActive(-1); }}>⌄</button></div>
    {open && <div className={styles.dropdown}><div id={`${id}-list`} role="listbox" aria-label="Flower suggestions" className={styles.list}>{matches.map((flower, index) => <button type="button" role="option" id={`${id}-${index}`} key={flower.name} aria-selected={index === active} tabIndex={-1} onMouseDown={event => event.preventDefault()} onClick={() => choose(flower)}><FlowerThumbnail flower={flower} /><span>{flower.name}{flower.colour && <small>{flower.colour}</small>}</span></button>)}</div>{!matches.length && <p>No match — you can add this flower using the name you typed.</p>}<p>{matches.length} matches · <a href={catalogue.source} target="_blank" rel="noreferrer">Flowervision Southampton</a><br />Names and reference photos saved {catalogue.importedAt}. Enter your own purchase price.</p></div>}
    {findCatalogueFlower(value) && !open && <span className={styles.selected}><FlowerThumbnail key={value} flower={findCatalogueFlower(value)} />Supplier reference photo</span>}
  </div>;
}
