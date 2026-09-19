'use client';
import { useState, type FormEvent } from 'react';
import styles from './inventory-details.module.css';
import type { StudioData, InventoryItem } from '@/lib/types';
import { stockSummary } from '@/lib/studio-commands';
import { newId, day } from '@/lib/operations-model';
import { Fields, Assets, type SaveData, type RunCommand } from './ops-ui';
import PhotoAssistance from './photo-assistance';
import Dialog from '../dialog';
export default function InventoryDetails({ data, save, command }: { data: StudioData; save: SaveData; command: RunCommand }) {
  const [search, setSearch] = useState('');
  const [item, setItem] = useState<InventoryItem | null>(null); const [busy, setBusy] = useState(false); const [waste, setWaste] = useState({ quantity: 1, reason: 'Past usable date', date: day(), notes: '' });
  const [wastePhoto, setWastePhoto] = useState<NonNullable<InventoryItem['image']>[]>([]);
  const [quickError, setQuickError] = useState('');
  async function addFlower(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('name') || '').trim();
    const quantity = Number(values.get('quantity'));
    const cost = Number(values.get('cost'));
    if (!name || name.length > 160 || !Number.isSafeInteger(quantity) || quantity <= 0 || !Number.isFinite(cost) || cost < 0) {
      setQuickError('Enter a flower name, whole units bought and a cost per stem of £0 or more.');
      return;
    }
    const flower: InventoryItem = { id: newId(), name, colour: '', stemsPurchased: quantity, stemsRemaining: quantity, costPerStem: cost, stockUnit: 'stem', category: 'Flowers', purchaseDate: day() };
    setBusy(true); setQuickError('');
    try {
      if (await save({ ...data, inventory: [flower, ...data.inventory] }, 'Flower added — ready to use in recipes.')) form.reset();
    } catch { setQuickError('The flower could not be saved. Your entries are still here; please try again.'); }
    finally { setBusy(false); }
  }
  return <section className="ops-panel">
    <h2>Add a flower</h2>
    <p>Enter the stems you bought. The flower and its cost will be ready in your recipes.</p>
    <form onSubmit={addFlower} className={styles.quickForm}>
      <fieldset disabled={busy}>
        <label>Flower name<input name="name" required maxLength={160} placeholder="e.g. White rose" /></label>
        <label>Units bought<input name="quantity" type="number" min="1" step="1" required placeholder="e.g. 20" /><small>Number of stems</small></label>
        <label>Cost per stem (£)<input name="cost" type="number" min="0" step="0.01" required placeholder="e.g. 1.25" /></label>
        <button className="button" type="submit">{busy ? 'Saving…' : 'Add flower'}</button>
      </fieldset>
      {quickError && <p role="alert">{quickError}</p>}
    </form>
    <div className="ops-section-title"><h2>Your flower stock</h2></div>
    <label className="ops-block-label">Find a flower<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your stock" /></label>
    <div className="ops-table-scroll"><table><thead><tr><th>Flower / item</th><th>Units bought</th><th>Available</th><th>Cost per stem / unit</th><th /></tr></thead><tbody>{data.inventory.filter(i => `${i.name} ${i.colour || ''} ${i.supplier || ''} ${i.location || ''}`.toLowerCase().includes(search.toLowerCase())).map(i => { const stock = stockSummary(data, i.id); return <tr key={i.id}><td>{i.name}{i.colour && <><br /><small>{i.colour}</small></>}</td><td>{i.stemsPurchased}</td><td>{stock.available}{stock.reserved > 0 && <><br /><small>{stock.reserved} reserved</small></>}</td><td>£{i.costPerStem.toFixed(2)}{i.stockUnit && i.stockUnit !== 'stem' && <small> / {i.stockUnit}</small>}</td><td><button type="button" disabled={busy} onClick={() => { setItem(structuredClone(i)); setWastePhoto([]); }}>Edit / wastage</button></td></tr>; })}</tbody></table>{!data.inventory.length && <p>Add your first flower above to start building recipes.</p>}</div>
    <details className={styles.advanced}><summary>Materials &amp; additional stock details</summary><p>Optional supplier, batch, dates, photographs and storage details.</p><button type="button" disabled={busy} onClick={() => setItem({ id: newId(), name: '', colour: '', costPerStem: 0, stemsPurchased: 0, stemsRemaining: 0, stockUnit: 'stem', category: 'Flowers', purchaseDate: day() })}>Add material or detailed stock item</button></details>
    {item && <Dialog label="Inventory details" className="ops-editor-dialog" onClose={() => { if (JSON.stringify(item) === JSON.stringify(data.inventory.find(i => i.id === item.id)) || confirm('Discard unsaved stock details?')) setItem(null); }}><h2>{item.name || 'New stock item'}</h2><fieldset disabled={busy}><Fields value={item} onChange={setItem} fields={[{ key: 'name', label: 'Flower / item name', required: true }, { key: 'costPerStem', label: 'Cost per stem / stock unit (£)', type: 'number' }, { key: 'stemsPurchased', label: 'Units bought', type: 'number' }, { key: 'stemsRemaining', label: 'Units available', type: 'number' }]} /><details className={styles.advanced}><summary>More details (optional)</summary><Fields value={item} onChange={setItem} fields={[{ key: 'colour', label: 'Colour' }, { key: 'category', label: 'Category', options: ['Flowers', 'Foliage', 'Packaging', 'Sundries', 'Vases', 'Other'] }, { key: 'stockUnit', label: 'Stock unit', options: ['stem', 'bunch', 'unit'] }, { key: 'supplier', label: 'Supplier' }, { key: 'batch', label: 'Batch reference' }, { key: 'purchaseDate', label: 'Purchase date', type: 'date' }, { key: 'usableDate', label: 'Use by', type: 'date' }, { key: 'expiryDate', label: 'Expiry date', type: 'date' }, { key: 'season', label: 'Season' }, { key: 'location', label: 'Storage location' }, { key: 'notes', label: 'Notes', type: 'textarea' }]} /><Assets imagesOnly max={1} label="Stock photograph" value={item.image ? [item.image] : []} onChange={images => setItem({ ...item, image: images[0] })} /><PhotoAssistance key={item.image?.id || item.id} assetId={item.image?.id} onUse={suggestion => setItem({ ...item, name: suggestion.name || item.name, colour: suggestion.colour || item.colour, notes: suggestion.notes, ...(!data.inventory.some(i => i.id === item.id) && suggestion.quantity !== null ? { stemsPurchased: suggestion.quantity, stemsRemaining: suggestion.quantity } : {}) })} /></details><button className="button" type="button" onClick={async () => { if (!item.name.trim()) return; setBusy(true); try { if (await save({ ...data, inventory: [item, ...data.inventory.filter(i => i.id !== item.id)] }, 'Stock details saved.')) setItem(null); } finally { setBusy(false); } }}>Save stock details</button>{data.inventory.some(i => i.id === item.id) && <><h2>Record wastage</h2><p>Waste uses the saved stock cost and available quantity. Save changes above before recording waste.</p><Fields value={waste} onChange={setWaste} fields={[{ key: 'quantity', label: 'Quantity lost', type: 'number' }, { key: 'reason', label: 'Reason', options: ['Past usable date', 'Damaged', 'Poor supplier quality', 'Unused surplus', 'Other'] }, { key: 'date', label: 'Date', type: 'date' }, { key: 'notes', label: 'Notes', type: 'textarea' }]} /><Assets imagesOnly max={1} label="Wastage photograph" value={wastePhoto} onChange={setWastePhoto} /><PhotoAssistance key={wastePhoto[0]?.id || 'waste'} assetId={wastePhoto[0]?.id} onUse={suggestion => setWaste({ ...waste, notes: `${suggestion.name}: ${suggestion.notes}`, ...(suggestion.quantity !== null ? { quantity: suggestion.quantity } : {}) })} /><button type="button" onClick={async () => { setBusy(true); try { if (await command({ type: 'waste', inventoryId: item.id, ...waste, image: wastePhoto[0] })) setItem(null); } finally { setBusy(false); } }}>Confirm wastage</button></>}</fieldset></Dialog>}
  </section>;
}
