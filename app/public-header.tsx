'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const links = [
  ['About', '#about'], ['Services', '#services'], ['Our work', '#work'], ['Sympathy', '#sympathy'], ['Enquire', '#enquire'],
] as const;

export default function PublicHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  return <nav className="bp-nav" aria-label="Main navigation">
    <a className="bp-brand" href="#top" aria-label="Bramble and Petal home">
      <Image src="/assets/brand-logo.png" alt="" width={136} height={93} priority />
    </a>
    <div className="bp-nav-links">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
    <Link className="bp-studio-link" href="/studio"><span aria-hidden="true">✾</span><span><b>Studio Hub</b><small>Staff sign in</small></span></Link>
    <button className="bp-menu-button" type="button" aria-expanded={open} aria-controls="bp-mobile-menu" onClick={() => setOpen(value => !value)}>
      <span className="bp-menu-label">Menu</span><span className="bp-menu-icon" aria-hidden="true"><i /><i /></span>
    </button>
    <div className="bp-mobile-menu" id="bp-mobile-menu" data-open={open} aria-hidden={!open}>
      <div>{links.map(([label, href], index) => <a key={href} href={href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{label}</a>)}</div>
      <Link href="/studio" onClick={() => setOpen(false)}>Open Studio Hub <span aria-hidden="true">→</span></Link>
    </div>
  </nav>;
}
