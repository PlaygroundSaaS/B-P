'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { calculateTotals, DEFAULT_SETTINGS, money } from '@/lib/pricing';
import type { Customer, InventoryItem, Material, Quote, QuoteLine, StudioData, WeddingPlan } from '@/lib/types';

const id = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
const initialData = (): StudioData => ({ version: 1, inventory: [], materials: [], customers: [], quotes: [], jobs: [], plans: [], settings: DEFAULT_SETTINGS });
const normaliseData = (value: Partial<StudioData>): StudioData => ({ ...initialData(), ...value, inventory: value.inventory || [], materials: value.materials || [], customers: value.customers || [], quotes: value.quotes || [], jobs: value.jobs || [], plans: value.plans || [], settings: { ...DEFAULT_SETTINGS, ...value.settings } });
const blankQuote = (settings: StudioData['settings']): Quote => ({ id: id(), clientName: '', contact: '', occasion: 'Bouquet', eventDate: '', lines: [], labourHours: 0, labourRate: settings.labourRate, wastagePercent: settings.defaultWastage, markupPercent: settings.defaultMarkup, deliveryFee: 0, discount: 0, vatApplies: true, vatRate: settings.vatRate, notes: '', createdAt: new Date().toISOString() });
const n = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;

export default function StudioClient() {
  const [data, setData] = useState<StudioData>(initialData);
  const [quote, setQuote] = useState<Quote>(blankQuote(DEFAULT_SETTINGS));
  const [screen, setScreen] = useState<'choose' | 'business' | 'client'>('choose');
  const [tab, setTab] = useState<'dashboard' | 'inventory' | 'calculator' | 'jobs' | 'clients' | 'settings'>('dashboard');
  const [clientType, setClientType] = useState<'Wedding' | 'Funeral' | 'Corporate'>('Wedding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = globalThis.localStorage.getItem('bramble-petal-studio-data');
    if (saved) {
      try {
        const loaded = normaliseData(JSON.parse(saved) as Partial<StudioData>);
        setData(loaded);
        setQuote(blankQuote(loaded.settings));
      } catch { globalThis.localStorage.removeItem('bramble-petal-studio-data'); }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let picker = document.getElementById('studio-material-picker') as HTMLDataListElement | null;
    if (!picker) { picker = document.createElement('datalist'); picker.id = 'studio-material-picker'; document.body.appendChild(picker); }
    picker.replaceChildren(...data.materials.map(material => { const option = document.createElement('option'); option.value = material.name; option.label = `${money(material.unitCost)} / ${material.unit}`; return option; }));
    const materialLines = quote.lines.filter(line => line.category === 'sundry');
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('.material-line > input'));
    const listeners = inputs.map((input, index) => {
      input.setAttribute('list', 'studio-material-picker');
      const line = materialLines[index];
      const syncMaterial = () => {
        const material = data.materials.find(item => item.name.toLocaleLowerCase() === input.value.toLocaleLowerCase());
        if (line && material) updateQuoteLine(line.id, { name: material.name, unitCost: material.unitCost });
      };
      input.addEventListener('change', syncMaterial);
      return () => input.removeEventListener('change', syncMaterial);
    });
    return () => listeners.forEach(remove => remove());
  }, [data.materials, quote.lines]);

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
    const item: InventoryItem = { id: id(), name: String(form.get('name') || ''), colour: String(form.get('colour') || ''), costPerStem: n(String(form.get('cost'))), stemsPurchased: n(String(form.get('stems'))), stemsRemaining: n(String(form.get('stems'))) };
    if (!item.name || item.stemsRemaining <= 0) return setError('Add a flower name and the number of stems.');
    void persist({ ...data, inventory: [item, ...data.inventory] }, 'Flower stock added.');
    event.currentTarget.reset(); setShowInventoryForm(false);
  };
  const restock = (itemId: string, stems: number) => {
    if (stems <= 0) return;
    const next = { ...data, inventory: data.inventory.map(item => item.id === itemId ? { ...item, stemsPurchased: item.stemsPurchased + stems, stemsRemaining: item.stemsRemaining + stems } : item) };
    void persist(next, 'Stock replenished.');
  };
  const addMaterial = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const material: Material = { id: id(), name: String(form.get('name') || ''), category: String(form.get('category') || 'General'), unit: String(form.get('unit') || 'each'), unitCost: n(String(form.get('cost'))) };
    if (!material.name) return setError('Add a material name.');
    void persist({ ...data, materials: [material, ...data.materials] }, 'Material added to the calculator list.');
    event.currentTarget.reset();
  };
  const removeMaterial = (materialId: string) => void persist({ ...data, materials: data.materials.filter(material => material.id !== materialId) }, 'Material removed.');
  const addOrUpdateCustomer = (source: StudioData, name: string, contact = '', notes = ''): StudioData => {
    const cleanName = name.trim();
    if (!cleanName) return source;
    const existing = source.customers.find(customer => customer.name.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    const customers: Customer[] = existing ? source.customers.map(customer => customer.id === existing.id ? { ...customer, contact: contact || customer.contact, notes: notes || customer.notes } : customer) : [{ id: id(), name: cleanName, contact, notes, createdAt: new Date().toISOString() }, ...source.customers];
    return { ...source, customers };
  };
  const addFlowerLine = () => {
    const flower = data.inventory[0];
    if (!flower) return setError('Add flowers to inventory before building a quote.');
    setQuote(current => ({ ...current, lines: [...current.lines, { id: id(), inventoryId: flower.id, name: flower.name, category: 'stem', quantity: 1, unitCost: flower.costPerStem }] }));
  };
  const addMaterialLine = () => {
    const material = data.materials[0];
    setQuote(current => ({ ...current, lines: [...current.lines, { id: id(), inventoryId: null, name: material?.name || '', category: 'sundry', quantity: 1, unitCost: material?.unitCost || 0 }] }));
  };
  const updateQuoteLine = (lineId: string, changes: Partial<QuoteLine>) => setQuote(current => ({ ...current, lines: current.lines.map(line => line.id === lineId ? { ...line, ...changes } : line) }));
  const chooseFlower = (lineId: string, inventoryId: string) => {
    const flower = data.inventory.find(item => item.id === inventoryId);
    if (flower) updateQuoteLine(lineId, { inventoryId: flower.id, name: flower.name, unitCost: flower.costPerStem });
  };
  const chooseMaterial = (lineId: string, materialId: string) => {
    const material = data.materials.find(item => item.id === materialId);
    if (material) updateQuoteLine(lineId, { name: material.name, unitCost: material.unitCost });
  };
  const removeQuoteLine = (lineId: string) => setQuote(current => ({ ...current, lines: current.lines.filter(line => line.id !== lineId) }));
  const saveQuote = () => {
    if (!quote.clientName) return setError('Add the client name before saving a quote.');
    void persist(addOrUpdateCustomer({ ...data, quotes: [quote, ...data.quotes] }, quote.clientName, quote.contact, quote.notes), 'Quote saved to the client record. No stock has moved.');
  };
  const winJob = () => {
    if (!quote.clientName || quote.lines.length === 0) return setError('Add a client and at least one line before winning a job.');
    const frozen = { ...quote, lines: quote.lines.map(line => ({ ...line })), wonAt: new Date().toISOString(), stockReturned: false, totals };
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: Math.max(0, item.stemsRemaining - quote.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0)) })), quotes: data.quotes.filter(saved => saved.id !== quote.id), jobs: [frozen, ...data.jobs] };
    void persist(addOrUpdateCustomer(next, quote.clientName, quote.contact, quote.notes), `Job won — ${money(totals.grossTotal)} saved and stock deducted.`);
    setQuote(blankQuote(data.settings)); setTab('jobs');
  };
  const returnStock = (jobId: string) => {
    const job = data.jobs.find(item => item.id === jobId); if (!job || job.stockReturned) return;
    const next: StudioData = { ...data, inventory: data.inventory.map(item => ({ ...item, stemsRemaining: item.stemsRemaining + job.lines.filter(line => line.inventoryId === item.id).reduce((sum, line) => sum + line.quantity, 0) })), jobs: data.jobs.map(item => item.id === jobId ? { ...item, stockReturned: true } : item) };
    void persist(next, 'Unused stems returned to stock.');
  };
  const savePlan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const plan: WeddingPlan = { id: id(), clientName: String(form.get('clientName') || ''), contact: String(form.get('contact') || ''), type: clientType, eventDate: String(form.get('eventDate') || ''), venue: String(form.get('venue') || ''), guestCount: form.get('guestCount') ? n(String(form.get('guestCount'))) : null, budget: form.get('budget') ? n(String(form.get('budget'))) : null, palette: String(form.get('palette') || ''), favouriteFlowers: String(form.get('favouriteFlowers') || ''), avoidFlowers: String(form.get('avoidFlowers') || ''), arrangements: String(form.get('arrangements') || ''), notes: String(form.get('notes') || ''), status: String(form.get('status') || 'Enquiry') as WeddingPlan['status'], finishedEstimate: form.get('estimate') ? n(String(form.get('estimate'))) : null, createdAt: new Date().toISOString() };
    if (!plan.clientName || !plan.notes) return setError('Add a client name and their floral brief.');
    void persist(addOrUpdateCustomer({ ...data, plans: [plan, ...data.plans] }, plan.clientName, plan.contact, plan.notes), 'Client plan saved to their customer record.');
    event.currentTarget.reset();
  };

  if (loading) return <main className="loading">Preparing your Studio Hub…</main>;
  if (screen === 'choose') return <main className="choose-screen"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Studio Hub</h1><p className="welcome-copy">Choose the space that suits this moment.</p><div className="choice-grid"><button className="choice-card" onClick={() => setScreen('business')}><span>FOR JADE &amp; THE TEAM</span><strong>Enter Business Side</strong><small>Inventory, quoting, jobs and client plans.</small></button><button className="choice-card" onClick={() => setScreen('client')}><span>FOR CONSULTATIONS</span><strong>Enter Client Planning Studio</strong><small>A customer-safe space for wedding, funeral and corporate planning.</small></button></div></main>;

  const nav = (name: typeof tab, label: string) => <button className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{label}</button>;
  return <main className="studio-shell"><header className="studio-nav"><button className="brand-button" onClick={() => setScreen('choose')}><b>✾</b><span>Bramble &amp; Petal<small>{screen === 'business' ? 'FLORIST STUDIO APP' : 'CLIENT PLANNING STUDIO'}</small></span></button>{screen === 'business' ? <nav>{nav('dashboard', 'Dashboard')}{nav('inventory', 'Inventory')}{nav('calculator', 'Calculator')}{nav('jobs', 'Jobs Won')}{nav('clients', 'Clients')}{nav('settings', 'Settings')}</nav> : <nav>{(['Wedding', 'Funeral', 'Corporate'] as const).map(type => <button className={clientType === type ? 'active' : ''} key={type} onClick={() => setClientType(type)}>{type}</button>)}</nav>}<button className="exit-button" onClick={() => setScreen('choose')}>Change space</button></header>
    {message && <p className="notice">{message}</p>}{error && <p className="notice error">{error}</p>}
    {screen === 'client' ? <section className="studio-content planner"><p className="eyebrow">CLIENT-SAFE PLANNING</p><h1>{clientType} flower plan</h1><p>Build a complete brief together. Internal costs, VAT and markup are never shown here.</p><form className="planner-form" onSubmit={savePlan}><section><h2>1. Client &amp; occasion</h2><div className="form-columns"><label>Client name<input name="clientName" required placeholder="Full name" /></label><label>Contact<input name="contact" placeholder="Phone or email" /></label><label>Event date<input name="eventDate" type="date" /></label><label>Venue / location<input name="venue" placeholder="Venue or address" /></label><label>Guests / attendees<input name="guestCount" type="number" min="0" /></label><label>Comfortable budget (£)<input name="budget" type="number" min="0" step="0.01" /></label></div></section><section><h2>2. Floral direction</h2><div className="form-columns"><label>Colour palette<input name="palette" placeholder="e.g. soft blush, cream and green" /></label><label>Favourite flowers<input name="favouriteFlowers" placeholder="Flowers they love" /></label><label>Flowers to avoid<input name="avoidFlowers" placeholder="Allergies, dislikes or exclusions" /></label><label>Plan status<select name="status" defaultValue="Enquiry"><option>Enquiry</option><option>Planning</option><option>Proposal sent</option><option>Booked</option></select></label></div><label>What arrangements are needed?<textarea name="arrangements" placeholder="Bouquet, buttonholes, ceremony flowers, tables, reception, tribute, corporate areas…" /></label></section><section><h2>3. Personal details &amp; next steps</h2><label>Story, inspiration and must-haves<textarea name="notes" required placeholder="Style, venue details, sentimental blooms, practical needs, priorities and follow-up actions…" /></label><label>Finished estimate to show client (£)<input name="estimate" type="number" min="0" step="0.01" /></label></section><button className="button" disabled={saving}>Save client plan</button></form><section className="records"><h2>Saved {clientType.toLowerCase()} plans</h2>{data.plans.filter(plan => plan.type === clientType).map(plan => <article key={plan.id}><b>{plan.clientName} <em>· {plan.status || 'Enquiry'}</em></b><span>{plan.eventDate || 'Date to confirm'} {plan.venue ? `· ${plan.venue}` : ''}</span><p>{plan.arrangements || plan.notes}</p>{plan.finishedEstimate !== null && <strong>{money(plan.finishedEstimate)}</strong>}</article>) || <p>No {clientType.toLowerCase()} plans saved yet.</p>}</section></section> : <section className="studio-content">
      {tab === 'dashboard' && <><div className="hero-title"><p className="eyebrow">BRAMBLE &amp; PETAL</p><h1>Studio Overview</h1><span>— ✾ —</span></div><div className="metric-grid"><article><small>INVENTORY VALUE<br />(EX VAT)</small><b>{money(stockValue)}</b></article><article><small>INVENTORY VALUE<br />(INC VAT)</small><b>{money(stockValue * 1.2)}</b></article><article><small>JOBS WON</small><b>{data.jobs.length}</b></article><article><small>TOTAL REVENUE</small><b>{money(data.jobs.reduce((sum, job) => sum + job.totals.grossTotal, 0))}</b></article></div><div className="dashboard-grid"><article><h2>Low &amp; out of stock</h2>{data.inventory.filter(item => item.stemsRemaining < 10).map(item => <p key={item.id}>{item.name} — {item.stemsRemaining} left</p>) || <p>Nothing low at the moment.</p>}</article><article><h2>Upcoming events</h2>{data.plans.slice(0, 3).map(plan => <p key={plan.id}>{plan.clientName} — {plan.type}</p>) || <p>No plans added yet.</p>}</article></div></>}
      {tab === 'inventory' && <><div className="workspace-heading"><div><p className="eyebrow">FLOWER INVENTORY</p><h1>Inventory hub</h1></div><button className="button" onClick={() => setShowInventoryForm(show => !show)}>{showInventoryForm ? 'Close' : '+ Add flower'}</button></div><section className="inventory-summary"><div><small>Total value (ex VAT)</small><strong>{money(stockValue)}</strong></div><div><small>VAT (20%)</small><strong>{money(stockValue * .2)}</strong></div><div><small>Total value (inc VAT)</small><strong>{money(stockValue * 1.2)}</strong></div></section>{showInventoryForm && <form className="panel-form inventory-form" onSubmit={addInventory}><label>Flower name<input name="name" required placeholder="e.g. White rose" /></label><label>Colour<input name="colour" placeholder="e.g. ivory" /></label><label>Cost per stem (£)<input name="cost" type="number" min="0" step="0.01" required /></label><label>Stems purchased<input name="stems" type="number" min="1" required /></label><button className="button" disabled={saving}>Save flower</button></form>}<section className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>Flower</th><th>Colour</th><th>Cost / stem</th><th>Purchased</th><th>Available</th><th /></tr></thead><tbody>{data.inventory.map(item => <tr key={item.id}><td>{item.name}</td><td>{item.colour || '—'}</td><td>{money(item.costPerStem)}</td><td>{item.stemsPurchased}</td><td><b>{item.stemsRemaining}</b></td><td><button onClick={() => restock(item.id, 10)}>+10</button></td></tr>)}</tbody></table>{data.inventory.length === 0 && <p className="empty-state">No flowers yet. Use “Add flower” to start your stock list.</p>}</section></>}
      {tab === 'calculator' && <><p className="eyebrow">PRICING CALCULATOR</p><h1>Build a bouquet or job</h1><div className="quote-workspace"><section className="quote-builder"><div className="quote-step"><h2>1. Customer &amp; job</h2><div className="form-columns"><label>Customer name<input value={quote.clientName} placeholder="e.g. Jane Smith" onChange={event => setQuote({ ...quote, clientName: event.target.value })} /></label><label>Contact<input value={quote.contact || ''} placeholder="phone / email" onChange={event => setQuote({ ...quote, contact: event.target.value })} /></label><label>Job type<select value={quote.occasion} onChange={event => setQuote({ ...quote, occasion: event.target.value as Quote['occasion'] })}><option>Bouquet</option><option>Wedding</option><option>Funeral</option><option>Corporate</option></select></label><label>Event / delivery date<input type="date" value={quote.eventDate} onChange={event => setQuote({ ...quote, eventDate: event.target.value })} /></label></div></div><div className="quote-step"><div className="step-title"><h2>2. Flowers used</h2><button onClick={addFlowerLine}>+ Add flower</button></div>{quote.lines.filter(line => line.category === 'stem').map(line => <div className="quote-line-editor" key={line.id}><select value={line.inventoryId || ''} onChange={event => chooseFlower(line.id, event.target.value)}>{data.inventory.map(item => <option key={item.id} value={item.id}>{item.name} — {item.stemsRemaining} stems</option>)}</select><label>Stems used<input aria-label="Stems used" type="number" min="1" value={line.quantity} onChange={event => updateQuoteLine(line.id, { quantity: n(event.target.value) })} /></label><b>{money(line.quantity * line.unitCost)}</b><button aria-label="Remove flower" onClick={() => removeQuoteLine(line.id)}>×</button></div>)}{quote.lines.filter(line => line.category === 'stem').length === 0 && <p className="quote-help">Add flowers from your current inventory.</p>}</div><div className="quote-step"><div className="step-title"><h2>3. Materials &amp; extras</h2><button onClick={addMaterialLine}>+ Add material</button></div>{quote.lines.filter(line => line.category === 'sundry').map(line => <div className="quote-line-editor material-line" key={line.id}><input value={line.name} placeholder="e.g. ribbon, vase or packaging" onChange={event => updateQuoteLine(line.id, { name: event.target.value })} /><label>Quantity<input aria-label="Material quantity" type="number" min="1" value={line.quantity} onChange={event => updateQuoteLine(line.id, { quantity: n(event.target.value) })} /></label><label>Unit cost (£)<input aria-label="Material unit cost" type="number" min="0" step="0.01" value={line.unitCost} onChange={event => updateQuoteLine(line.id, { unitCost: n(event.target.value) })} /></label><button aria-label="Remove material" onClick={() => removeQuoteLine(line.id)}>×</button></div>)}{quote.lines.filter(line => line.category === 'sundry').length === 0 && <p className="quote-help">Add packaging, vases, ribbon or other extras.</p>}</div><div className="quote-step"><h2>4. Pricing</h2><div className="form-columns"><label>Markup %<input type="number" min="0" value={quote.markupPercent} onChange={event => setQuote({ ...quote, markupPercent: n(event.target.value) })} /></label><label>VAT / Tax %<input type="number" min="0" value={quote.vatRate} onChange={event => setQuote({ ...quote, vatRate: n(event.target.value) })} /></label><label>Labour hours<input type="number" min="0" step="0.5" value={quote.labourHours} onChange={event => setQuote({ ...quote, labourHours: n(event.target.value) })} /></label><label>Delivery (£)<input type="number" min="0" value={quote.deliveryFee} onChange={event => setQuote({ ...quote, deliveryFee: n(event.target.value) })} /></label></div><label>Notes<textarea value={quote.notes || ''} placeholder="Any notes about this order…" onChange={event => setQuote({ ...quote, notes: event.target.value })} /></label></div></section><aside className="quote-summary"><h2>Order summary</h2><span>Flowers cost <b>{money(totals.stemCost)}</b></span><span>Materials cost <b>{money(totals.sundryCost)}</b></span><span>Base cost <b>{money(totals.costSubtotal)}</b></span><span>Markup ({quote.markupPercent}%) <b>{money(totals.markup)}</b></span><span>VAT ({quote.vatRate}%) <b>{money(totals.vat)}</b></span><strong>Total price <b>{money(totals.grossTotal)}</b></strong><button className="button job-won" onClick={winJob} disabled={saving}>Job won — save &amp; deduct stock</button><button className="secondary-action" onClick={saveQuote}>Save quote without stock change</button></aside></div></>}
      {tab === 'jobs' && <><p className="eyebrow">JOBS WON</p><h1>Your completed work</h1><section className="records wide">{data.jobs.map(job => <article key={job.id}><b>{job.clientName} — {job.occasion}</b><span>{job.lines.length} line{job.lines.length === 1 ? '' : 's'} · won {new Date(job.wonAt).toLocaleDateString('en-GB')}</span><strong>{money(job.totals.grossTotal)}</strong>{!job.stockReturned && <button onClick={() => returnStock(job.id)}>Stems not used — return to stock</button>}{job.stockReturned && <em>Stock returned</em>}</article>) || <p>No jobs won yet.</p>}</section></>}
      {tab === 'clients' && <><p className="eyebrow">CUSTOMER DATABASE</p><h1>Your client book</h1><section className="client-directory">{data.customers.map(customer => { const clientPlans = data.plans.filter(plan => plan.clientName.toLocaleLowerCase() === customer.name.toLocaleLowerCase()); const clientJobs = data.jobs.filter(job => job.clientName.toLocaleLowerCase() === customer.name.toLocaleLowerCase()); return <article key={customer.id}><p className="eyebrow">{clientPlans.length} plan{clientPlans.length === 1 ? '' : 's'} · {clientJobs.length} job{clientJobs.length === 1 ? '' : 's'}</p><h2>{customer.name}</h2><span>{customer.contact || 'No contact details yet'}</span><p>{customer.notes || 'No notes saved yet.'}</p>{clientPlans.slice(0, 2).map(plan => <small key={plan.id}>{plan.type}: {plan.eventDate || 'date to confirm'} {plan.status ? `· ${plan.status}` : ''}</small>)}</article>})}</section>{data.customers.length === 0 && <p className="empty-state">Clients are added automatically when you save a quote, job or planning brief.</p>}</>}
      {tab === 'settings' && <><p className="eyebrow">STUDIO SETTINGS</p><h1>Materials &amp; pricing</h1><div className="settings-grid"><form className="panel-form" onSubmit={addMaterial}><h2>Add a material or extra</h2><label>Name<input name="name" required placeholder="e.g. Ivory satin ribbon" /></label><label>Category<input name="category" placeholder="e.g. Packaging" /></label><label>Unit<select name="unit" defaultValue="each"><option>each</option><option>metre</option><option>pack</option><option>vase</option></select></label><label>Cost per unit (£)<input name="cost" required type="number" min="0" step="0.01" /></label><button className="button" disabled={saving}>Add material</button></form><section className="records"><h2>Material price list</h2>{data.materials.map(material => <article key={material.id}><b>{material.name}</b><span>{material.category} · {money(material.unitCost)} / {material.unit}</span><button onClick={() => removeMaterial(material.id)}>Remove</button></article>) || <p>No materials yet. Add ribbon, containers, packaging and delivery extras here.</p>}</section></div></>}
    </section>}
  </main>;
}

