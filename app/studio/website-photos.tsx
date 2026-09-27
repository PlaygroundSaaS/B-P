'use client';
import { useCallback, useEffect, useState } from 'react';
import type { GalleryKey, SitePhoto } from '@/lib/site-photos';
import { Heading } from './ops-ui';
import styles from './website-photos.module.css';

type Gallery = { key: GalleryKey; title: string; where: string; href: string; max: number; photos: SitePhoto[]; updatedAt: string | null };
type Message = { tone: 'status' | 'alert'; text: string };
const MAX_UPLOAD = 3 * 1024 * 1024;

// Phone photos are often too large to upload as they are, so each one is
// resized in the browser to a web-friendly JPEG first.
async function preparePhoto(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = new globalThis.Image();
    image.src = url;
    await image.decode().catch(() => { throw new Error(`${file.name} could not be opened. Use a JPEG, PNG or WebP photo.`); });
    for (const [edge, quality] of [[2000, .86], [1600, .8], [1200, .75]]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error(`${file.name} could not be prepared.`);
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_UPLOAD) return { blob, width: canvas.width, height: canvas.height };
    }
    throw new Error(`${file.name} is too large to use. Try a smaller copy of the photo.`);
  } finally { URL.revokeObjectURL(url); }
}

export default function WebsitePhotos() {
  const [galleries, setGalleries] = useState<Gallery[] | null>(null), [library, setLibrary] = useState<SitePhoto[]>([]), [error, setError] = useState('');
  const load = useCallback(async () => {
    const response = await fetch('/api/studio/website-photos', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Website photos could not be loaded. Please try again.');
    setGalleries(result.galleries); setLibrary(result.library);
  }, []);
  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : 'Website photos could not be loaded.')); }, [load]);
  return <div className={styles.page}>
    <Heading eyebrow="YOUR WEBSITE" title="Website photos"><p>Add, remove and arrange the photos in the website’s galleries. Nothing changes on the website until you press Save for that gallery.</p></Heading>
    {error && <p role="alert" className={styles.alert}>{error}</p>}
    {!galleries && !error && <p className={styles.muted}>Loading photos…</p>}
    {galleries?.map(gallery => <GalleryEditor key={gallery.key} gallery={gallery} library={library} onSaved={saved => setGalleries(list => list && list.map(item => item.key === saved.key ? saved : item))} />)}
  </div>;
}

function GalleryEditor({ gallery, library, onSaved }: { gallery: Gallery; library: SitePhoto[]; onSaved: (gallery: Gallery) => void }) {
  const [photos, setPhotos] = useState(gallery.photos), [busy, setBusy] = useState<'' | 'uploading' | 'saving'>(''), [message, setMessage] = useState<Message | null>(null);
  useEffect(() => setPhotos(gallery.photos), [gallery.photos]);
  const dirty = JSON.stringify(photos) !== JSON.stringify(gallery.photos);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const room = gallery.max - photos.length;
  const unused = library.filter(photo => !photos.some(item => item.src === photo.src));
  const change = (next: (list: SitePhoto[]) => SitePhoto[]) => { setPhotos(next); setMessage(null); };
  const move = (from: number, to: number) => change(list => { const next = [...list]; const [photo] = next.splice(from, 1); next.splice(to, 0, photo); return next; });

  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy('uploading'); setMessage(null);
    const chosen = files.slice(0, room);
    try {
      for (const file of chosen) {
        const { blob, width, height } = await preparePhoto(file);
        const form = new FormData(); form.append('file', blob, `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`);
        const response = await fetch('/api/studio/website-photos', { method: 'POST', body: form });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.photo) throw new Error(result.error || `${file.name} could not be uploaded.`);
        setPhotos(list => [...list, { src: result.photo.src, alt: '', width, height }]);
      }
      setMessage({ tone: 'status', text: `${chosen.length === 1 ? 'Photo' : `${chosen.length} photos`} added at the end.${files.length > chosen.length ? ` ${files.length - chosen.length} more did not fit: this gallery holds up to ${gallery.max}.` : ''} Add a description, arrange them, then press Save.` });
    } catch (error) {
      setMessage({ tone: 'alert', text: error instanceof Error ? error.message : 'The photo could not be uploaded.' });
    } finally { setBusy(''); }
  }

  async function save() {
    setBusy('saving'); setMessage(null);
    try {
      const response = await fetch('/api/studio/website-photos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gallery: gallery.key, photos, updatedAt: gallery.updatedAt }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The photos could not be saved. Please try again.');
      onSaved({ ...gallery, photos: result.photos, updatedAt: result.updatedAt });
      setMessage({ tone: 'status', text: 'Saved. The website now shows these photos in this order.' });
    } catch (error) {
      setMessage({ tone: 'alert', text: error instanceof Error ? error.message : 'The photos could not be saved.' });
    } finally { setBusy(''); }
  }

  const headingId = `website-gallery-${gallery.key}`;
  return <section className={`ops-panel ${styles.gallery}`} aria-labelledby={headingId}>
    <header className={styles.header}>
      <div><h2 id={headingId}>{gallery.title}</h2><p>{gallery.where}</p></div>
      <a href={gallery.href} target="_blank" rel="noreferrer">View on website ↗</a>
    </header>
    <p className={styles.count}>{photos.length} of {gallery.max} photos{dirty && <b> · Unsaved changes</b>}</p>
    {photos.length ? <ol className={styles.grid}>{photos.map((photo, index) => <li key={photo.src} className={styles.card}>
      <div className={styles.thumb}>
        {/* A plain img: unsaved uploads load only with the Studio sign-in, which the image optimiser doesn't carry. */}
        <img src={photo.src} alt="" loading="lazy" />
        <span className={styles.position} aria-hidden="true">{index + 1}</span>
        <button type="button" disabled={!!busy} className={styles.remove} aria-label={`Remove photo ${index + 1}`} onClick={() => change(list => list.filter((_, i) => i !== index))}>Remove</button>
      </div>
      <label className={styles.description}>Description <small>(for Google and screen readers)</small>
        <textarea rows={2} maxLength={200} value={photo.alt} disabled={!!busy} placeholder="For example: blush roses and white dahlias in a bridal bouquet" onChange={event => { const alt = event.target.value; change(list => list.map((item, i) => i === index ? { ...item, alt } : item)); }} />
      </label>
      <div className={styles.actions}>
        <button type="button" disabled={!!busy || index === 0} aria-label={`Move photo ${index + 1} earlier`} title="Move earlier" onClick={() => move(index, index - 1)}>←</button>
        <button type="button" disabled={!!busy || index === photos.length - 1} aria-label={`Move photo ${index + 1} later`} title="Move later" onClick={() => move(index, index + 1)}>→</button>
        <select aria-label={`Position of photo ${index + 1}`} disabled={!!busy || photos.length < 2} value={index} onChange={event => move(index, Number(event.target.value))}>
          {photos.map((_, i) => <option key={i} value={i}>{i === index ? `Position ${i + 1}` : `Move to ${i + 1}`}</option>)}
        </select>
      </div>
    </li>)}</ol> : <p className={styles.empty}>No photos. This part of the website stays hidden until you add at least one and save.</p>}
    <div className={styles.add}>
      <div className={styles.upload}>
        <label className={styles.uploadButton} data-disabled={!!busy || room <= 0 || undefined}>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple disabled={!!busy || room <= 0} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void upload(files); }} />
          {busy === 'uploading' ? 'Uploading…' : '+ Upload photos'}
        </label>
        <small>{room > 0 ? 'New photos go at the end. Large phone photos are resized automatically.' : `This gallery is full. Remove a photo to add another (up to ${gallery.max}).`}</small>
      </div>
      {unused.length > 0 && <details className={styles.library}>
        <summary>Put back a photo that was on the website ({unused.length})</summary>
        <div>{unused.map(photo => <button type="button" key={photo.src} disabled={!!busy || room <= 0} title={photo.alt} aria-label={`Add to this gallery: ${photo.alt}`} onClick={() => change(list => [...list, photo])}>
          <img src={photo.src} alt="" loading="lazy" />
        </button>)}</div>
      </details>}
    </div>
    {message && <p role={message.tone} className={message.tone === 'alert' ? styles.alert : styles.notice}>{message.text}</p>}
    {dirty && <div className={styles.savebar}>
      <p>Unsaved changes to {gallery.title}</p>
      <button type="button" className="button" disabled={!!busy} onClick={() => void save()}>{busy === 'saving' ? 'Saving…' : 'Save to website'}</button>
      <button type="button" disabled={!!busy} onClick={() => { setPhotos(gallery.photos); setMessage(null); }}>Undo changes</button>
    </div>}
  </section>;
}
