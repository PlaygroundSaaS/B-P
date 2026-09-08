'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { StudioAsset, StudioCommand } from '@/lib/operations-types';
import type { StudioData } from '@/lib/types';
export type SaveData = (data: StudioData, message: string) => Promise<boolean>;
export type RunCommand = (command: StudioCommand) => Promise<StudioData | null>;
export type OpenRecord = (tab: string, id?: string) => void;
export type FieldSpec = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'time' | 'textarea' | 'email' | 'url' | 'checkbox'; options?: string[]; required?: boolean; hint?: string };
export function Fields<T extends object>({ value, onChange, fields }: { value: T; onChange: (value: T) => void; fields: FieldSpec[] }) {
  const values = value as Record<string, unknown>;
  return <div className="ops-fields">{fields.map(f => <label key={f.key} className={f.type === 'textarea' ? 'ops-wide' : ''}><span>{f.label}</span>{f.options ? <select value={String(values[f.key] ?? '')} onChange={e => onChange({ ...value, [f.key]: e.target.value })}>{f.options.map(o => <option key={o}>{o}</option>)}</select> : f.type === 'textarea' ? <textarea rows={3} value={String(values[f.key] ?? '')} onChange={e => onChange({ ...value, [f.key]: e.target.value })} maxLength={10000} /> : f.type === 'checkbox' ? <input type="checkbox" checked={values[f.key] === true} onChange={e => onChange({ ...value, [f.key]: e.target.checked })} /> : <input type={f.type || 'text'} required={f.required} min={f.type === 'number' ? 0 : undefined} step={f.type === 'number' ? 'any' : undefined} value={String(values[f.key] ?? '')} onChange={e => onChange({ ...value, [f.key]: f.type === 'number' ? e.target.value === '' && ['sellingPriceExVat', 'corporationTaxRate'].includes(f.key) ? undefined : Number(e.target.value) : e.target.value })} maxLength={f.type === 'text' || !f.type ? 1000 : undefined} />}{f.hint && <small>{f.hint}</small>}</label>)}</div>;
}
export function Photo({ src, alt, className = '' }: { src?: string; alt: string; className?: string }) {
  return src ? <Image src={src} alt={alt} width={720} height={540} sizes="(max-width: 640px) 100vw, 33vw" unoptimized={src.startsWith('/api/') || src.startsWith('data:')} className={`ops-photo ${className}`} /> : <div className={`ops-photo ops-photo-empty ${className}`} aria-label="No photo added"><span aria-hidden="true">✾</span></div>;
}
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) { return <div className="ops-empty"><span aria-hidden="true">✾</span><h2>{title}</h2>{children}</div>; }
export function Heading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) { return <div className="ops-heading"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</div>; }
export function Assets({ value, onChange, imagesOnly = false, label = 'Add images or PDF', max = 12, removable = true }: { value: StudioAsset[]; onChange: (value: StudioAsset[]) => void; imagesOnly?: boolean; label?: string; max?: number; removable?: boolean }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <div className="ops-assets"><label className="ops-upload"><span>{busy ? 'Uploading…' : label}</span><input aria-label={label} type="file" multiple accept={imagesOnly ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,application/pdf'} disabled={busy || value.length >= max} onChange={async e => {
    const files = Array.from(e.target.files || []).slice(0, max - value.length); e.target.value = ''; setBusy(true); setError(''); const added = [...value];
    try { for (const file of files) { if (file.size > 3 * 1024 * 1024) throw new Error(`${file.name}: use a file under 3 MB.`); const form = new FormData(); form.append('file', file); const response = await fetch('/api/studio/assets', { method: 'POST', body: form }); const result = await response.json(); if (!response.ok) throw new Error(result.error); added.push(result.asset); onChange([...added]); } } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); } finally { setBusy(false); }
  }} /><small>JPEG, PNG, WebP{!imagesOnly && ' or PDF'} · up to 3 MB each</small></label>{error && <p role="alert">{error}</p>}<div className="ops-asset-list">{value.map(a => <figure key={a.id}>{a.type.startsWith('image/') ? <Photo src={a.url} alt={a.name} /> : <span className="ops-file-icon">PDF</span>}<figcaption><a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>{removable && <button type="button" aria-label={`Remove ${a.name}`} onClick={() => onChange(value.filter(v => v.id !== a.id))}>×</button>}</figcaption></figure>)}</div></div>;
}
export function Status({ children }: { children: React.ReactNode }) { return <span className="ops-status">{children}</span>; }
