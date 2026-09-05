'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const links = [
  ['About', '#about'], ['Services', '#services'], ['Our work', '#work'], ['Weddings', '#weddings'], ['Sympathy', '#sympathy'], ['Enquire', '#enquire'],
] as const;

export default function PublicHeader() {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(document.querySelectorAll<HTMLElement>('.bp-hero, .bp-site > main, .bp-footer'));
    const prior = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const focusFrame = requestAnimationFrame(() => menu.current?.querySelector('a')?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); }
      if (event.key === 'Tab') {
        const links = Array.from(menu.current?.querySelectorAll('a') || []);
        const last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === menuButton.current) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); menuButton.current?.focus(); }
      }
    };
    const wider = window.matchMedia('(min-width: 761px)');
    const closeWhenWide = () => { if (wider.matches) setOpen(false); };
    wider.addEventListener('change', closeWhenWide);
    document.addEventListener('keydown', closeOnEscape);
    return () => { cancelAnimationFrame(focusFrame); background.forEach((element, index) => { element.inert = prior[index]; }); document.body.style.overflow = previous; document.removeEventListener('keydown', closeOnEscape); wider.removeEventListener('change', closeWhenWide); };
  }, [open]);

  return <nav className="bp-nav" data-menu-open={open} aria-label="Main navigation">
    <a className="bp-brand" href="#top" aria-label="Bramble and Petal home">
      <Image src="/assets/brand-logo.png" alt="" width={136} height={93} priority />
    </a>
    <div className="bp-nav-links">{links.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</div>
    <Link className="bp-studio-link" href="/studio"><span aria-hidden="true">✾</span><span><b>Studio Hub</b><small>Staff sign in</small></span></Link>
    <button ref={menuButton} className="bp-menu-button" type="button" aria-expanded={open} aria-controls="bp-mobile-menu" onClick={() => setOpen(value => !value)}>
      <span className="bp-menu-label">Menu</span><span className="bp-menu-icon" aria-hidden="true"><i /><i /></span>
    </button>
    <div ref={menu} className="bp-mobile-menu" id="bp-mobile-menu" data-open={open} aria-hidden={!open}>
      <div>{links.map(([label, href], index) => <a key={href} href={href} onClick={() => setOpen(false)}><span>0{index + 1}</span>{label}</a>)}</div>
      <Link href="/studio" onClick={() => setOpen(false)}>Open Studio Hub <span aria-hidden="true">→</span></Link>
    </div>
  </nav>;
}
