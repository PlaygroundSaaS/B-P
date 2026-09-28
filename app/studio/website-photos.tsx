'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { presentPhotos, uploadedPhotoId, type GalleryKey, type SectionPhotos, type SitePhoto } from '@/lib/site-photos';
import { Heading } from './ops-ui';
import styles from './website-photos.module.css';

type Spot = { name: string; empty?: string };
type Section = { key: GalleryKey; page: string; title: string; where: string; tip?: string; href: string; kind: 'gallery' | 'spots'; max?: number; spots?: Spot[]; photos: SectionPhotos; updatedAt: string | null };
type Message = { tone: 'status' | 'alert'; text: string };
type Busy = '' | 'uploading' | 'saving';
const MAX_UPLOAD = 3 * 1024 * 1024;
const unique = (photos: SitePhoto[]) => photos.filter((photo, index, all) => all.findIndex(other => other.src === photo.src) === index);

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

// Uploads one photo. It stays private until a section showing it is saved.
async function uploadPhoto(file: File): Promise<SitePhoto> {
  const { blob, width, height } = await preparePhoto(file);
  const form = new FormData(); form.append('file', blob, `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`);
  const response = await fetch('/api/studio/website-photos', { method: 'POST', body: form });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.photo) throw new Error(result.error || `${file.name} could not be uploaded.`);
  return { src: result.photo.src, alt: '', width, height };
}

export default function WebsitePhotos() {
  const [sections, setSections] = useState<Section[] | null>(null), [library, setLibrary] = useState<SitePhoto[]>([]), [error, setError] = useState('');
  const [page, setPage] = useState(''), [unsaved, setUnsaved] = useState<Partial<Record<GalleryKey, boolean>>>({});
  const load = useCallback(async () => {
    const response = await fetch('/api/studio/website-photos', { cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Website photos could not be loaded. Please try again.');
    setSections(result.galleries); setLibrary(result.library);
  }, []);
  useEffect(() => { load().catch(e => setError(e instanceof Error ? e.message : 'Website photos could not be loaded.')); }, [load]);
  const onDirty = useCallback((key: GalleryKey, dirty: boolean) => setUnsaved(list => list[key] === dirty ? list : { ...list, [key]: dirty }), []);
  const onSaved = useCallback((saved: Section) => {
    setSections(list => list && list.map(item => item.key === saved.key ? saved : item));
    // A newly saved upload can then be chosen for any other part of the website too.
    setLibrary(list => unique([...list, ...presentPhotos(saved.photos).filter(photo => uploadedPhotoId(photo.src))]));
  }, []);
  const pages = sections ? [...new Set(sections.map(section => section.page))] : [];
  const current = page || pages[0];
  return <div className={styles.page}>
    <Heading eyebrow="YOUR WEBSITE" title="Website photos"><p>Choose a page, then change its photos. Nothing on the website changes until you press Save.</p></Heading>
    {error && <p role="alert" className={styles.alert}>{error}</p>}
    {!sections && !error && <p className={styles.muted}>Loading photos…</p>}
    {sections && <>
      <nav className={styles.pages} aria-label="Website pages">{pages.map(name => {
        const changed = sections.some(section => section.page === name && unsaved[section.key]);
        return <button type="button" key={name} aria-pressed={name === current} onClick={() => setPage(name)}>{name}{changed && <span className={styles.dot} aria-label=" (unsaved changes)" />}</button>;
      })}</nav>
      {pages.map(name => <div key={name} hidden={name !== current}>
        {sections.filter(section => section.page === name).map(section => section.kind === 'gallery'
          ? <GalleryEditor key={section.key} section={section} library={library} onSaved={onSaved} onDirty={onDirty} />
          : <SpotsEditor key={section.key} section={section} library={library} onSaved={onSaved} onDirty={onDirty} />)}
      </div>)}
    </>}
  </div>;
}

type EditorProps = { section: Section; library: SitePhoto[]; onSaved: (section: Section) => void; onDirty: (key: GalleryKey, dirty: boolean) => void };

// The unsaved photos for one section, and saving them to the website.
function useSection({ section, onSaved, onDirty }: EditorProps) {
  const [photos, setPhotos] = useState(section.photos), [busy, setBusy] = useState<Busy>(''), [message, setMessage] = useState<Message | null>(null);
  useEffect(() => setPhotos(section.photos), [section.photos]);
  const dirty = JSON.stringify(photos) !== JSON.stringify(section.photos);
  useEffect(() => onDirty(section.key, dirty), [dirty, onDirty, section.key]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const change = (next: (list: SectionPhotos) => SectionPhotos) => { setPhotos(next); setMessage(null); };
  async function save() {
    setBusy('saving'); setMessage(null);
    try {
      const response = await fetch('/api/studio/website-photos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gallery: section.key, photos, updatedAt: section.updatedAt }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'The photos could not be saved. Please try again.');
      onSaved({ ...section, photos: result.photos, updatedAt: result.updatedAt });
      setMessage({ tone: 'status', text: 'Saved. The website now shows these photos.' });
    } catch (error) {
      setMessage({ tone: 'alert', text: error instanceof Error ? error.message : 'The photos could not be saved.' });
    } finally { setBusy(''); }
  }
  const undo = () => { setPhotos(section.photos); setMessage(null); };
  return { photos, change, busy, setBusy, message, setMessage, dirty, save, undo };
}

function SectionShell({ section, state, children }: { section: Section; state: ReturnType<typeof useSection>; children: ReactNode }) {
  const headingId = `website-section-${section.key}`;
  return <section className={`ops-panel ${styles.gallery}`} aria-labelledby={headingId}>
    <header className={styles.header}>
      <div><h2 id={headingId}>{section.title}</h2><p>{section.where}{section.tip && <> {section.tip}</>}</p></div>
      <a href={section.href} target="_blank" rel="noreferrer">View on website ↗</a>
    </header>
    {children}
    {state.message && <p role={state.message.tone} className={state.message.tone === 'alert' ? styles.alert : styles.notice}>{state.message.text}</p>}
    {state.dirty && <div className={styles.savebar}>
      <p>Unsaved changes to {section.page}: {section.title}</p>
      <button type="button" className="button" disabled={!!state.busy} onClick={() => void state.save()}>{state.busy === 'saving' ? 'Saving…' : 'Save to website'}</button>
      <button type="button" disabled={!!state.busy} onClick={state.undo}>Undo changes</button>
    </div>}
  </section>;
}

// A plain img: unsaved uploads load only with the Studio sign-in, which the image optimiser doesn't carry.
const Thumb = ({ photo }: { photo: SitePhoto }) => <img src={photo.src} alt="" loading="lazy" />;

// A row or grid of photos: add, remove and arrange.
function GalleryEditor(props: EditorProps) {
  const { section, library } = props;
  const state = useSection(props), { change, busy } = state;
  const photos = presentPhotos(state.photos), max = section.max ?? 0, room = max - photos.length;
  const unused = library.filter(photo => !photos.some(item => item.src === photo.src));
  const move = (from: number, to: number) => change(list => { const next = [...list]; const [photo] = next.splice(from, 1); next.splice(to, 0, photo); return next; });

  async function upload(files: File[]) {
    if (!files.length) return;
    state.setBusy('uploading'); state.setMessage(null);
    const chosen = files.slice(0, room);
    try {
      for (const file of chosen) { const photo = await uploadPhoto(file); change(list => [...list, photo]); }
      state.setMessage({ tone: 'status', text: `${chosen.length === 1 ? 'Photo' : `${chosen.length} photos`} added at the end.${files.length > chosen.length ? ` ${files.length - chosen.length} more did not fit: this holds up to ${max}.` : ''} Arrange them, then press Save.` });
    } catch (error) {
      state.setMessage({ tone: 'alert', text: error instanceof Error ? error.message : 'The photo could not be uploaded.' });
    } finally { state.setBusy(''); }
  }

  return <SectionShell section={section} state={state}>
    <p className={styles.count}>{photos.length} of {max} photos{state.dirty && <b> · Unsaved changes</b>}</p>
    {photos.length ? <ol className={styles.grid}>{photos.map((photo, index) => <li key={photo.src} className={styles.card}>
      <div className={styles.thumb}>
        <Thumb photo={photo} />
        <span className={styles.position} aria-hidden="true">{index + 1}</span>
        <button type="button" disabled={!!busy} className={styles.remove} aria-label={`Remove photo ${index + 1}`} onClick={() => change(list => list.filter((_, i) => i !== index))}>Remove</button>
      </div>
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
        <small>{room > 0 ? 'New photos go at the end. Large phone photos are resized automatically.' : `This is full. Remove a photo to add another (up to ${max}).`}</small>
      </div>
      {unused.length > 0 && <details className={styles.library}>
        <summary>Add a photo already on the website ({unused.length})</summary>
        <div>{unused.map((photo, index) => <button type="button" key={photo.src} disabled={!!busy || room <= 0} aria-label={`Add website photo ${index + 1}`} onClick={() => change(list => [...list, photo])}>
          <Thumb photo={photo} />
        </button>)}</div>
      </details>}
    </div>
  </SectionShell>;
}

// Single photos in the page design: swap each one, and remove the ones that can be empty.
function SpotsEditor(props: EditorProps) {
  const { section, library } = props;
  const state = useSection(props), { photos, change, busy } = state;
  const spots = section.spots ?? [], named = spots.length > 1;
  const [picking, setPicking] = useState<number | null>(null);
  const picker = useRef<HTMLDivElement>(null);
  useEffect(() => { if (picking !== null) picker.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [picking]);
  const label = (index: number) => named ? spots[index].name : section.title;
  const put = (index: number, photo: SitePhoto | null) => change(list => list.map((item, i) => i === index ? photo : item));

  async function upload(index: number, file: File | undefined) {
    if (!file) return;
    state.setBusy('uploading'); state.setMessage(null);
    try {
      put(index, await uploadPhoto(file)); setPicking(null);
      state.setMessage({ tone: 'status', text: 'Photo added. Press Save to put it on the website.' });
    } catch (error) {
      state.setMessage({ tone: 'alert', text: error instanceof Error ? error.message : 'The photo could not be uploaded.' });
    } finally { state.setBusy(''); }
  }

  return <SectionShell section={section} state={state}>
    {state.dirty && <p className={styles.count}><b>Unsaved changes</b></p>}
    <ul className={`${styles.grid} ${styles.spots}`}>{spots.map((spot, index) => {
      const photo = photos[index];
      return <li key={spot.name} className={styles.card} data-picking={picking === index || undefined}>
        <div className={styles.thumb}>
          {photo ? <Thumb photo={photo} /> : <p className={styles.emptySpot}>No photo. {spot.empty}</p>}
          {photo && spot.empty && <button type="button" disabled={!!busy} className={styles.remove} aria-label={`Remove photo: ${label(index)}`} onClick={() => { put(index, null); if (picking === index) setPicking(null); }}>Remove</button>}
        </div>
        {named && <p className={styles.spotName}>{spot.name}</p>}
        <div className={styles.actions}>
          <button type="button" disabled={!!busy} aria-expanded={picking === index} aria-label={`${photo ? 'Change' : 'Add'} photo: ${label(index)}`} onClick={() => setPicking(picking === index ? null : index)}>{photo ? 'Change photo' : 'Add photo'}</button>
        </div>
      </li>;
    })}</ul>
    {picking !== null && <div ref={picker} className={styles.picker} role="group" aria-label={`Choose a photo for ${label(picking)}`}>
      <div className={styles.pickerHeader}>
        <h3>Choose a photo for {label(picking)}</h3>
        <button type="button" disabled={!!busy} onClick={() => setPicking(null)}>Cancel</button>
      </div>
      <div className={styles.upload}>
        <label className={styles.uploadButton} data-disabled={!!busy || undefined}>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/*" disabled={!!busy} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(picking, file); }} />
          {busy === 'uploading' ? 'Uploading…' : '+ Upload a photo'}
        </label>
        <small>Or pick one already on the website below. Large phone photos are resized automatically.</small>
      </div>
      <div className={styles.choices}>{library.map((photo, index) => {
        const chosen = photos[picking]?.src === photo.src;
        return <button type="button" key={photo.src} disabled={!!busy} aria-pressed={chosen} aria-label={`Use website photo ${index + 1}`} onClick={() => { put(picking, photo); setPicking(null); }}>
          <Thumb photo={photo} />{chosen && <span>In use</span>}
        </button>;
      })}</div>
    </div>}
  </SectionShell>;
}
