'use client';
import Image from 'next/image';
import { useState } from 'react';
import Dialog from './dialog';
import styles from './wedding-gallery.module.css';

type Photo = { src: string; alt: string; label: string };
export default function WeddingGallery({ images }: { images: Photo[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const photo = selected === null ? null : images[selected];
  return <>
    <div className={styles.grid}>{images.map((photo, index) => <figure className={styles.photo} key={photo.src}>
      <button className="wedding-photo-button" onClick={() => setSelected(index)} aria-label={`Enlarge: ${photo.label}`}>
        <Image src={photo.src} alt={photo.alt} width={1536} height={2048} sizes="(max-width: 600px) calc(100vw - 48px), (max-width: 1020px) 43vw, (max-width: 1500px) 29vw, 428px" />
        <span aria-hidden="true">View photo ↗</span>
      </button><figcaption>{photo.label}</figcaption>
    </figure>)}</div>
    {photo && selected !== null && <Dialog className="wedding-lightbox" label="Wedding photo gallery" onClose={() => setSelected(null)}>
      <div className="wedding-lightbox-content" onKeyDown={event => { if (event.key === 'ArrowRight') setSelected((selected + 1) % images.length); if (event.key === 'ArrowLeft') setSelected((selected + images.length - 1) % images.length); }}>
        <button className="gallery-close" aria-label="Close gallery" onClick={() => setSelected(null)}>Close ×</button>
        <Image src={photo.src} alt={photo.alt} width={1536} height={2048} sizes="(max-width: 760px) 90vw, 70vh" />
        <div className="gallery-controls"><button aria-label="Previous photo" onClick={() => setSelected((selected + images.length - 1) % images.length)}>←</button><p aria-live="polite">{selected + 1} / {images.length} · {photo.label}</p><button aria-label="Next photo" onClick={() => setSelected((selected + 1) % images.length)}>→</button></div>
      </div>
    </Dialog>}
  </>;
}
