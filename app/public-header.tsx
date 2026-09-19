'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
const links = [['Home','/'],['Weddings','/weddings'],['Funerals','/funerals'],['Corporate','/corporate'],['Flowers','/flowers'],['Our Studio','/our-studio'],['Client Studio','/client-studio']] as const;
export default function PublicHeader() {
  const [open,setOpen] = useState(false); const trigger = useRef<HTMLButtonElement>(null); const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const background = Array.from(document.querySelectorAll<HTMLElement>('.public-site > main, .public-footer')); const prior = background.map(e => e.inert); background.forEach(e => {e.inert = true;});
    const frame = requestAnimationFrame(() => menu.current?.querySelector('a')?.focus());
    const key = (e: KeyboardEvent) => { if(e.key === 'Escape') {setOpen(false);trigger.current?.focus();} if(e.key === 'Tab') { const nodes = Array.from(menu.current?.querySelectorAll('a') || []); const last=nodes[nodes.length-1]; if(e.shiftKey && document.activeElement===nodes[0]) {e.preventDefault();trigger.current?.focus();} else if(e.shiftKey && document.activeElement===trigger.current) {e.preventDefault();last?.focus();} else if(!e.shiftKey && document.activeElement===last) {e.preventDefault();trigger.current?.focus();} else if(!e.shiftKey && document.activeElement===trigger.current) {e.preventDefault();nodes[0]?.focus();} } };
    const media=matchMedia('(min-width: 1101px)'); const resize=()=>{if(media.matches)setOpen(false);}; media.addEventListener('change',resize); document.addEventListener('keydown',key);
    return ()=>{ cancelAnimationFrame(frame); document.body.style.overflow=previous; background.forEach((e,i)=>{e.inert=prior[i];});document.removeEventListener('keydown',key);media.removeEventListener('change',resize);};
  },[open]);
  return <header className="public-header" id="top"><Link href="/" className="public-brand" aria-label="Bramble and Petal home"><Image src="/assets/brand-mark.jpg" alt="" width={70} height={65} /><span>BRAMBLE &amp; PETAL<small>FLORIST STUDIO</small></span></Link><nav className="public-desktop-nav" aria-label="Main navigation">{links.map(([title,url])=><Link key={url} href={url}>{title}</Link>)}</nav><Link href="/contact" className="public-header-enquire">Enquire</Link><button ref={trigger} className="public-menu-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="public-menu" onClick={()=>setOpen(!open)}><span /><span /></button><div ref={menu} id="public-menu" className="public-mobile-menu" hidden={!open}><nav aria-label="Mobile navigation">{links.map(([title,url],i)=><Link key={url} href={url} onClick={()=>setOpen(false)}><small>0{i+1}</small>{title}</Link>)}<Link href="/contact" onClick={()=>setOpen(false)}>Enquire <span aria-hidden="true">→</span></Link></nav></div></header>;
}
