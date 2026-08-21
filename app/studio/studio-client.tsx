'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { calculateTotals, DEFAULT_SETTINGS, money } from '@/lib/pricing';
import type { InventoryItem, Quote, QuoteLine, StudioData, WeddingPlan } from '@/lib/types';

const id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const initialData = (): StudioData => ({ version: 1, inventory: [], quotes: [], jobs: [], plans: [], settings: DEFAULT_SETTINGS });
const blankQuote = (settings: StudioData['settings']): Quote => ({ id: id(), clientName: '', occasion: 'Bouquet', eventDate: '', lines: [], labourHours: 0, labourRate: settings.labourRate, wastagePercent: settings.defaultWastage, markupPercent: settings.defaultMarkup, deliveryFee: 0, discount: 0, vatApplies: true, vatRate: settings.vatRate, createdAt: new Date().toISOString() });
const n = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function StudioClient() {
  const [data, setData] = useState<StudioData>(initialData);
  const [quote, setQuote] = useState<Quote>(blankQuote(DEFAULT_SETTINGS));
  const [screen, setScreen] = useState<'choose' | 'business' | 'client'>('choose');
  const [tab, setTab] = useState<'dashboard' | 'inventory' | 'calculator' | 'jobs' | 'plans'>('dashboard');
  const [clientType, setClientType] = useState<'Wedding' | 'Funeral' | 'Corporate'>('Wedding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = globalThis.localStorage.getItem('bramble-petal-studio-data');
    if (saved) {
      try {
        const loaded = JSON.parse(saved) as StudioData;
        setData(loaded);
        setQuote(blankQuote(loaded.settings));
      } catch { globalThis.localStorage.removeItem('bramble-petal-studio-data'); }
    }
    setLoading(false);
  }, []);

  const persist = async (next: StudioData, success: string) => {
    setData(next); setSaving(true); setError('');
    try {
      globalThis.localStorage.setItem('bramble-petal-studio-data', JSON.stringify(next));
      setMessage(success);
    } catch { setError('Your browser could not save this change locally.'); }
    finally { setSaving(false); }
  };
  const totals = useMemo(() => calculateTotals(quote), [quote]);
  const stockValue = data.inventory.reduce((sum, item) => sum + item.stemsRemaining * item.costPerStem, 0);

  const addInventory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const item: InventoryItem = { id: id(), name: String(form.get('name') || ''), costPerStem: n(String(form.get('cost'))), stemsPurchased: n(String(form.get('stems'))), stemsRemaining: n(String(form.get('stems'))) };
    if (!item.name || item.stemsRemaining <= 0) return setError('Add a flower name and the number of stems.');
    void persist({ ...data, inventory: [item, ...data.inventory] }, 'Flower stock added.');
    event.currentTarget.reset();
  };
  const restock = (itemId: string, stems: number) => {
    if (stems <= 0) return;
    const next = { ...data, inventory: data.inventory.map(item => item.id === itemId ? { ...item, stemsPurchased: item.stemsPurchased + stems, stemsRemaining: item.stemsRemaining + stems } : item) };
    void persist(next, 'Stock replenished.');
  };
  const addFromInventory = (item: InventoryItem) => setQuote(current => {
    const existing = current.lines.find(line => line.inventoryId === item.id);
    const lines = existing ? current.lines.map(line => line.inventoryId === item.id ? { ...line, quantity: line.quantity + 1, unitCost: item.costPerStem } : line) : [...current.lines, { id: id(), inventoryId: item.id, name: item.name, category: 'stem' as const, quantity: 1, unitCost: item.costPerStem }];
    return { ...current, lines };
  });
  const saveQuote = () => {
    if (!quote.clientName) return setError('Add the client name before saving a quote.');
    void persist({ ...data, quotes: [quote, ...data.quotes] }, 'Quote saved. No stock has moved.');
  };
  const winJob = () => {
    if (!quote.clientName || quote.lines.length === 0) return setError('Add a client and at least one line before winning a job.');
    const frozen = { ...quote, lines: quote.lines.map(line => ({ ...line })), wonAt: new Date().toISOString(), stockReturned: false, totals };
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: Math.max(0, item.stemsRemaining - quote.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0)) })), quotes: data.quotes.filter(saved => saved.id !== quote.id), jobs: [frozen, ...data.jobs] };
    void persist(next, `Job won — ${money(totals.grossTotal)} saved and stock deducted.`);
    setQuote(blankQuote(data.settings)); setTab('jobs');
  };
  const returnStock = (jobId: string) => {
    const job = data.jobs.find(item => item.id === jobId); if (!job || job.stockReturned) return;
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: item.stemsRemaining + job.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0) })), jobs: data.jobs.map(item => item.id === jobId ? { ...item, stockReturned: true } : item) };
    void persist(next, 'Unused stems returned to stock.');
  };
  const savePlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const plan: WeddingPlan = { id: id(), clientName: String(form.get('clientName') || ''), type: clientType, eventDate: String(form.get('eventDate') || ''), notes: String(form.get('notes') || ''), finishedEstimate: form.get('estimate') ? n(String(form.get('estimate'))) : null, createdAt: new Date().toISOString() };
    if (!plan.clientName || !plan.notes) return setError('Add a client name and their floral brief.');
    void persist({ ...data, plans: [plan, ...data.plans] }, 'Client plan saved to the studio database.');
    event.currentTarget.reset();
  };

  if (loading) return <main className="loading">Preparing your Studio Hub…</main>;
  if (screen === 'choose') return <main className="choose-screen"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Studio Hub</h1><p className="welcome-copy">Choose the space that suits this moment.</p><div className="choice-grid"><button className="choice-card" onClick={() => setScreen('business')}><span>FOR JADE &amp; THE TEAM</span><strong>Enter Business Side</strong><small>Inventory, quoting, jobs and client plans.</small></button><button className="choice-card" onClick={() => setScreen('client')}><span>FOR CONSULTATIONS</span><strong>Enter Client Planning Studio</strong><small>A customer-safe space for wedding, funeral and corporate planning.</small></button></div></main>;

  const nav = (name: typeof tab, label: string) => <button className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{label}</button>;
  return <main className="studio-shell"><header className="studio-nav"><button className="brand-button" onClick={() => setScreen('choose')}><b>✾</b><span>Bramble &amp; Petal<small>{screen === 'business' ? 'FLORIST STUDIO APP' : 'CLIENT PLANNING STUDIO'}</small></span></button>{screen === 'business' ? <nav>{nav('dashboard', 'Dashboard')}{nav('inventory', 'Inventory')}{nav('calculator', 'Calculator')}{nav('jobs', 'Jobs Won')}{nav('plans', 'Wedding Planner')}</nav> : <nav>{(['Wedding', 'Funeral', 'Corporate'] as const).map(type => <button className={clientType === type ? 'active' : ''} key={type} onClick={() => setClientType(type)}>{type}</button>)}</nav>}<button className="exit-button" onClick={() => setScreen('choose')}>Change space</button></header>
    {message && <p className="notice">{message}</p>}{error && <p className="notice error">{error}</p>}
    {screen === 'client' ? <section className="studio-content planner"><p className="eyebrow">CLIENT-SAFE PLANNING</p><h1>{clientType} flower plan</h1><p>Capture every wish, favourite flower and meaningful detail. Internal cost, VAT and markup are never shown here.</p><form className="panel-form" onSubmit={savePlan}><label>Client name<input name="clientName" required /></label><label>Event date<input name="eventDate" type="date" /></label><label>What matters most?<textarea name="notes" required placeholder="Favourite flowers, colours, venue, personal details and must-haves…" /></label><label>Finished estimate (£)<input name="estimate" type="number" min="0" step="0.01" /></label><button className="button" disabled={saving}>Save our ideas</button></form><section className="records"><h2>Saved ideas</h2>{data.plans.filter(plan => plan.type === clientType).map(plan => <article key={plan.id}><b>{plan.clientName}</b><span>{plan.eventDate || 'Date to confirm'}</span><p>{plan.notes}</p>{plan.finishedEstimate !== null && <strong>{money(plan.finishedEstimate)}</strong>}</article>) || <p>No {clientType.toLowerCase()} plans saved yet.</p>}</section></section> : <section className="studio-content">
      {tab === 'dashboard' && <><div className="hero-title"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Studio Overview</h1><span>— ✾ —</span></div><div className="metric-grid"><article><small>INVENTORY VALUE<br />(EX VAT)</small><b>{money(stockValue)}</b></article><article><small>INVENTORY VALUE<br />(INC VAT)</small><b>{money(stockValue * 1.2)}</b></article><article><small>JOBS WON</small><b>{data.jobs.length}</b></article><article><small>TOTAL REVENUE</small><b>{money(data.jobs.reduce((sum, job) => sum + job.totals.grossTotal, 0))}</b></article></div><div className="dashboard-grid"><article><h2>Low &amp; out of stock</h2>{data.inventory.filter(item => item.stemsRemaining < 10).map(item => <p key={item.id}>{item.name} — {item.stemsRemaining} left</p>) || <p>Nothing low at the moment.</p>}</article><article><h2>Upcoming events</h2>{data.plans.slice(0, 3).map(plan => <p key={plan.id}>{plan.clientName} — {plan.type}</p>) || <p>No plans added yet.</p>}</article></div></>}
      {tab === 'inventory' && <><p className="eyebrow">FLOWER INVENTORY</p><h1>What’s in the studio</h1><div className="tool-grid"><form className="panel-form" onSubmit={addInventory}><label>Flower name<input name="name" required placeholder="e.g. White rose" /></label><label>Stems purchased<input name="stems" type="number" min="1" required /></label><label>Cost per stem (£)<input name="cost" type="number" min="0" step="0.01" required /></label><button className="button" disabled={saving}>Add to inventory</button></form><section className="records"><h2>Current stock</h2>{data.inventory.map(item => <article key={item.id}><b>{item.name}</b><span>{item.stemsRemaining} stems remaining · {money(item.costPerStem)}/stem</span><button onClick={() => restock(item.id, 10)}>+ 10 stems</button></article>) || <p>No flowers added yet.</p>}</section></div></>}
      {tab === 'calculator' && <><p className="eyebrow">PRICING CALCULATOR</p><h1>Build a bouquet or job</h1><div className="calculator-grid"><section className="panel-form"><label>Client name<input value={quote.clientName} onChange={event => setQuote({ ...quote, clientName: event.target.value })} /></label><label>Occasion<select value={quote.occasion} onChange={event => setQuote({ ...quote, occasion: event.target.value as Quote['occasion'] })}><option>Bouquet</option><option>Wedding</option><option>Funeral</option><option>Corporate</option></select></label><label>Labour hours<input type="number" min="0" step="0.5" value={quote.labourHours} onChange={event => setQuote({ ...quote, labourHours: n(event.target.value) })} /></label><label>Delivery (£)<input type="number" min="0" value={quote.deliveryFee} onChange={event => setQuote({ ...quote, deliveryFee: n(event.target.value) })} /></label><label>Markup %<input type="number" min="0" value={quote.markupPercent} onChange={event => setQuote({ ...quote, markupPercent: n(event.target.value) })} /></label><h2>Add from inventory</h2><div className="inventory-picks">{data.inventory.map(item => <button key={item.id} onClick={() => addFromInventory(item)}>{item.name}<small>{item.stemsRemaining} stems</small></button>) || <p>Add inventory first.</p>}</div></section><section className="records quote-lines"><h2>Quote lines</h2>{quote.lines.map(line => <article key={line.id}><b>{line.name}</b><span><input type="number" min="1" value={line.quantity} onChange={event => setQuote({ ...quote, lines: quote.lines.map(current => current.id === line.id ? { ...current, quantity: n(event.target.value) } : current) })} /> stems × {money(line.unitCost)}</span><button onClick={() => setQuote({ ...quote, lines: quote.lines.filter(current => current.id !== line.id) })}>Remove</button></article>) || <p>Select stems from inventory.</p>}<div className="totals"><span>Stem cost <b>{money(totals.stemCost)}</b></span><span>Wastage <b>{money(totals.wastage)}</b></span><span>Labour <b>{money(totals.labour)}</b></span><span>VAT <b>{money(totals.vat)}</b></span><strong>Customer total <b>{money(totals.grossTotal)}</b></strong></div><div className="actions"><button onClick={saveQuote}>Save quote</button><button className="button" onClick={winJob} disabled={saving}>Job won</button></div></section></div></>}
      {tab === 'jobs' && <><p className="eyebrow">JOBS WON</p><h1>Your completed work</h1><section className="records wide">{data.jobs.map(job => <article key={job.id}><b>{job.clientName} — {job.occasion}</b><span>{job.lines.length} line{job.lines.length === 1 ? '' : 's'} · won {new Date(job.wonAt).toLocaleDateString('en-GB')}</span><strong>{money(job.totals.grossTotal)}</strong>{!job.stockReturned && <button onClick={() => returnStock(job.id)}>Stems not used — return to stock</button>}{job.stockReturned && <em>Stock returned</em>}</article>) || <p>No jobs won yet.</p>}</section></>}
      {tab === 'plans' && <><p className="eyebrow">CUSTOMER DATABASE</p><h1>Wedding &amp; event planner</h1><section className="records wide">{data.plans.map(plan => <article key={plan.id}><b>{plan.clientName} — {plan.type}</b><span>{plan.eventDate || 'Date to confirm'}</span><p>{plan.notes}</p></article>) || <p>No client plans saved yet.</p>}</section></>}
    </section>}
  </main>;
}

