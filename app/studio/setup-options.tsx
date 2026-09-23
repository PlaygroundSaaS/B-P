'use client';
import Image from 'next/image';
import { money } from '@/lib/pricing';
import type { WeddingSetupOption, PlanReferenceImage } from '@/lib/types';

const studioPhotos = [
  ['/assets/weddings/wedding-02.jpg', 'Ceremony flowers on stone plinths'],
  ['/assets/weddings/wedding-03.jpg', 'Pastel flowers and natural texture'],
  ['/assets/weddings/wedding-04.jpg', 'Wedding flowers beside a tall window'],
  ['/assets/weddings/wedding-05.jpg', 'Pastel arrangement on a pedestal'],
  ['/assets/weddings/wedding-07.jpg', 'A large wedding arrangement'],
  ['/assets/weddings/wedding-09.jpg', 'Green, white and pale yellow flowers'],
];
export default function SetupOptions({ options, onChange, presentation = false, references = [] }: { references?: PlanReferenceImage[]; options: WeddingSetupOption[]; onChange?: (options: WeddingSetupOption[]) => void; presentation?: boolean }) {
  const photos = [...studioPhotos, ...references.map(reference => [reference.dataUrl, reference.caption || reference.name])];
  const update = (id: string, changes: Partial<WeddingSetupOption>) => onChange?.(options.map(option => option.id === id ? { ...option, ...changes } : option));
  const selected = options.filter(option => option.selected);
  const total = selected.reduce((sum, option) => sum + option.quantity * (option.unitPrice || 0), 0);
  const pending = selected.some(option => option.unitPrice === null);
  return <div className={`setup-options ${presentation ? 'setup-presentation' : ''}`}>
    <div className="setup-heading"><div><p className="eyebrow">YOUR WEDDING, BROUGHT TO LIFE</p><h2>{presentation ? 'Picture your day.' : 'Potential flower setups'}</h2><p>Explore the look, choose the pieces you love and see the proposed cost.</p></div>{!presentation && <button type="button" onClick={() => onChange?.([...options, { id: crypto.randomUUID(), title: '', description: '', quantity: 1, unitPrice: null, photoSrc: '', selected: true }])}>+ Add setup option</button>}</div>
    <div className="setup-grid">{options.map((option, index) => <article className="setup-card" key={option.id}>
      {option.photoSrc && <div className="setup-image"><Image unoptimized={option.photoSrc.startsWith('data:') || option.photoSrc.startsWith('/api/')} src={option.photoSrc} alt={photos.find(photo => photo[0] === option.photoSrc)?.[1] || option.title} width={768} height={1024} sizes="(max-width: 760px) 90vw, 40vw" /><span>Inspiration · colours and flowers can be tailored</span></div>}
      {presentation ? <div className="setup-card-body"><p className="eyebrow">OPTION {String(index + 1).padStart(2, '0')}</p><h3>{option.title || 'Floral setup'}</h3><p>{option.description || 'Details to be shaped together.'}</p><div className="setup-price"><span>{option.quantity} × {option.unitPrice === null ? 'Price to confirm' : money(option.unitPrice)}</span><b>{option.unitPrice === null ? 'To confirm' : money(option.quantity * option.unitPrice)}</b></div><span className="setup-included">{option.selected ? 'Included in this proposal' : 'Alternative option'}</span></div> : <div className="setup-card-body">
        <label>Setup name<input value={option.title} placeholder="e.g. Ceremony flowers on plinths" onChange={event => update(option.id, { title: event.target.value })} /></label>
        <label>Describe the look<textarea value={option.description} placeholder="Flowers, palette, placement and what is included…" onChange={event => update(option.id, { description: event.target.value })} /></label>
        <label>Inspiration photo<select value={option.photoSrc} onChange={event => update(option.id, { photoSrc: event.target.value })}><option value="">No photo</option>{photos.map(([src, label]) => <option key={src} value={src}>{label}</option>)}</select><small className="setup-photo-help">Use a studio photo or add your own images to the plan’s reference board.</small></label>
        <div className="setup-cost-fields"><label>Quantity<input type="number" min="1" step="1" value={option.quantity} onChange={event => update(option.id, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} /></label><label>Price to client per setup (£)<input type="number" min="0" step="0.01" value={option.unitPrice ?? ''} placeholder="To confirm" onChange={event => update(option.id, { unitPrice: event.target.value === '' ? null : Math.max(0, Number(event.target.value)) })} /></label></div>
        <div className="setup-price"><label className="setup-checkbox"><input type="checkbox" checked={option.selected} onChange={event => update(option.id, { selected: event.target.checked })} />Include in proposal</label><b>{option.unitPrice === null ? 'To confirm' : money(option.quantity * option.unitPrice)}</b></div><button className="setup-remove" type="button" onClick={() => onChange?.(options.filter(item => item.id !== option.id))}>Remove option</button>
      </div>}
    </article>)}</div>
    {!options.length && <p className="empty-state">Add a ceremony, table or bouquet idea with an inspiration photo and a price to discuss together.</p>}
    {options.length > 0 && <div className="setup-total"><div><span>{selected.length} setup option{selected.length === 1 ? '' : 's'} included</span><small>{presentation ? 'Proposed prices, including any applicable VAT. Final details to be agreed.' : 'Enter the full client price, including any applicable VAT. This proposal is separate from internal flower costing.'}</small></div><strong>{pending ? `From ${money(total)}` : money(total)}{pending && <small>Some prices still to confirm</small>}</strong></div>}
  </div>;
}
