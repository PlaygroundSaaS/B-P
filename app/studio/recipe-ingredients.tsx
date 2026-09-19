'use client';
import type { StudioData, QuoteLine, InventoryItem } from '@/lib/types';
import { newId } from '@/lib/operations-model';
import styles from './recipe-ingredients.module.css';

const isFlower = (item: InventoryItem) => !item.category || ['flowers', 'foliage', 'stems'].includes(item.category.toLowerCase());
export default function RecipeIngredients({ data, lines, onChange }: { data: StudioData; lines: QuoteLine[]; onChange: (lines: QuoteLine[]) => void }) {
  const flowers = data.inventory.filter(isFlower);
  const flowerLines = lines.filter(line => line.category === 'stem' && line.costCategory !== 'Packaging');
  const extras = lines.filter(line => !flowerLines.includes(line));
  const update = (id: string, changes: Partial<QuoteLine>) => onChange(lines.map(line => line.id === id ? { ...line, ...changes } : line));
  const remove = (id: string) => onChange(lines.filter(line => line.id !== id));
  function addFlower() {
    const item = flowers.find(item => item.stemsRemaining > 0) || flowers[0];
    if (!item) return;
    onChange([...lines, { id: newId(), inventoryId: item.id, name: item.name, category: 'stem', costCategory: 'Flower', quantity: 1, unitCost: item.costPerStem, stockUnit: item.stockUnit || 'stem' }]);
  }
  const addExtra = (costCategory: 'Sundry' | 'Packaging') => onChange([...lines, { id: newId(), inventoryId: null, name: '', category: 'sundry', costCategory, quantity: 1, unitCost: 0, stockUnit: 'unit' }]);
  return <>
    <section className={styles.section} aria-labelledby="recipe-flowers-heading">
      <div className="ops-section-title"><h2 id="recipe-flowers-heading">Flowers</h2><span>Quantities per arrangement</span></div>
      {flowerLines.map((line, index) => <div className={`ops-recipe-line ${styles.flowerRow}`} key={line.id}>
        <label>Flower {index + 1}<select value={line.inventoryId || ''} onChange={event => { const item = flowers.find(item => item.id === event.target.value); if (item) update(line.id, { inventoryId: item.id, name: item.name, unitCost: item.costPerStem, stockUnit: item.stockUnit || 'stem', category: 'stem', costCategory: 'Flower' }); }}>
          {!flowers.some(item => item.id === line.inventoryId) && <option value={line.inventoryId || ''}>{line.name || 'Choose a flower'}{line.inventoryId ? ' · no longer in stock list' : ''}</option>}
          {flowers.map(item => <option key={item.id} value={item.id}>{item.name} · {item.stemsRemaining} available</option>)}
        </select></label>
        <label>Quantity<input type="number" min="0" step="1" value={line.quantity} onChange={event => update(line.id, { quantity: Number(event.target.value) })} /></label>
        <label>Cost per {line.stockUnit === 'bunch' ? 'bunch' : 'stem'} (£)<input type="number" min="0" step="0.0001" value={line.unitCost} onChange={event => update(line.id, { unitCost: Number(event.target.value) })} /></label>
        <button type="button" aria-label={`Remove ${line.name || 'flower'}`} onClick={() => remove(line.id)}>×</button>
      </div>)}
      {!flowers.length && <p className="ops-help">Add flowers in Flower stock first. Their names and costs will appear here automatically.</p>}
      <button type="button" disabled={!flowers.length} onClick={addFlower}>+ Add flower</button>
    </section>
    <section className={`${styles.section} ${styles.extras}`} aria-labelledby="recipe-extras-heading">
      <div className="ops-section-title"><h2 id="recipe-extras-heading">Sundries &amp; packaging</h2><span>Optional extras</span></div>
      {extras.map(line => {
        const packaging = line.costCategory === 'Packaging';
        const stock = data.inventory.filter(item => !isFlower(item) && (item.category?.toLowerCase() === 'packaging') === packaging);
        const materials = data.materials.filter(item => (item.category.toLowerCase() === 'packaging') === packaging);
        return <div className={styles.extraItem} key={line.id}><p className={styles.extraLabel}>{packaging ? 'Packaging' : 'Sundry'}</p><div className={`ops-recipe-line ${styles.extraRow}`}>
          <label>{packaging ? 'Packaging item' : 'Sundry item'}<select value={line.inventoryId ? `stock:${line.inventoryId}` : ''} onChange={event => {
            const value = event.target.value;
            if (value.startsWith('stock:')) { const item = stock.find(item => item.id === value.slice(6)); if (item) update(line.id, { inventoryId: item.id, name: item.name, unitCost: item.costPerStem, stockUnit: item.stockUnit || 'unit', category: 'sundry' }); }
            else if (value.startsWith('material:')) { const item = materials.find(item => item.id === value.slice(9)); if (item) update(line.id, { inventoryId: null, name: item.name, unitCost: item.unitCost, stockUnit: 'unit', category: 'sundry' }); }
            else update(line.id, { inventoryId: null });
          }}><option value="">Enter below or choose a saved item</option>{line.inventoryId && !stock.some(item => item.id === line.inventoryId) && <option value={`stock:${line.inventoryId}`}>{line.name} · linked stock</option>}{stock.map(item => <option key={item.id} value={`stock:${item.id}`}>{item.name} · {item.stemsRemaining} available</option>)}{materials.map(item => <option key={item.id} value={`material:${item.id}`}>{item.name} · £{item.unitCost.toFixed(2)}</option>)}</select></label>
          <label>Name<input value={line.name} onChange={event => update(line.id, { name: event.target.value })} placeholder={packaging ? 'e.g. Bouquet wrap' : 'e.g. Ribbon or vase'} /></label>
          <label>Quantity<input type="number" min="0" step="any" value={line.quantity} onChange={event => update(line.id, { quantity: Number(event.target.value) })} /></label>
          <label>Unit cost (£)<input type="number" min="0" step="0.0001" value={line.unitCost} onChange={event => update(line.id, { unitCost: Number(event.target.value) })} /></label>
          <button type="button" aria-label={`Remove ${line.name || (packaging ? 'packaging' : 'sundry')}`} onClick={() => remove(line.id)}>×</button>
        </div></div>;
      })}
      <div className="ops-toolbar"><button type="button" onClick={() => addExtra('Sundry')}>+ Add sundry</button><button type="button" onClick={() => addExtra('Packaging')}>+ Add packaging</button></div>
    </section>
  </>;
}
