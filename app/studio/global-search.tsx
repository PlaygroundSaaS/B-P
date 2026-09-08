'use client';
import { useState } from 'react';
import type { StudioData } from '@/lib/types';
import type { OpenRecord } from './ops-ui';
export default function GlobalSearch({ data, open }: { data: StudioData; open: OpenRecord }) {
  const [query, setQuery] = useState('');
  const rows = [
    ...data.customers.map(c => ({ id: c.id, title: c.name, detail: c.contact, type: 'Client', tab: 'clients' })),
    ...data.plans.map(p => ({ id: p.id, title: p.clientName, detail: `${p.type} · ${p.eventDate} · ${p.venue || ''}`, type: 'Event', tab: 'clients' })),
    ...[...data.quotes, ...data.jobs].map(r => ({ id: r.id, title: r.name || r.occasion, detail: r.clientName, type: 'Recipe', tab: 'calculator' })),
    ...data.inventory.map(i => ({ id: i.id, title: i.name, detail: `${i.colour || ''} · ${i.supplier || ''}`, type: 'Stock', tab: 'inventory' })),
    ...(data.operations?.suppliers || []).map(s => ({ id: s.id, title: s.name, detail: s.products, type: 'Supplier', tab: 'suppliers' })),
  ].filter(r => `${r.title} ${r.detail}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  return <div className="ops-global-search ops-no-print"><label>Search your Studio<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Clients, events, recipes, stock, suppliers…" /></label>{query.trim() && <div className="ops-search-results">{rows.length ? rows.map(r => <button type="button" key={`${r.type}-${r.id}`} onClick={() => { open(r.tab, r.id); setQuery(''); }}><span>{r.type}</span><b>{r.title}</b><small>{r.detail}</small></button>) : <p>No matching records.</p>}</div>}</div>;
}
