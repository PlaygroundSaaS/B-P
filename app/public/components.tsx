import { businessSchema } from '@/lib/site-seo';
import { StructuredData } from './seo';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import PublicHeader from '../public-header';

export function Brand() { return <span className="public-brand-lockup"><Image src="/assets/brand-mark.jpg" width={78} height={70} alt="" /><span>BRAMBLE &amp; PETAL<small>FLORIST STUDIO</small></span></span>; }
export function Arrow() { return <span aria-hidden="true">⟶</span>; }
export function TextLink({ href, children }: { href: string; children: ReactNode }) { return <Link className="public-text-link" href={href}>{children}<Arrow /></Link>; }
export function Intro({ label, title, children }: { label: string; title: ReactNode; children?: ReactNode }) { return <div className="public-intro"><p className="public-kicker">{label}</p><h2>{title}</h2>{children && <p className="public-copy">{children}</p>}</div>; }
export function PhotoFrame({ src, alt, className = '', sizes = '(max-width: 700px) 100vw, 50vw', position = 'center', preload = false }: { src: string; alt: string; className?: string; sizes?: string; position?: string; preload?: boolean }) { return <figure className={`public-photo ${className}`}><Image src={src} alt={alt} fill sizes={sizes} preload={preload} style={{objectPosition:position}} /></figure>; }
export function PublicFooter() { return <footer className="public-footer" id="contact"><div className="public-footer-top"><Link href="/" aria-label="Bramble and Petal home"><Brand /></Link><div><h2>Let’s create something beautiful.</h2><p>Tell us about your occasion.</p><TextLink href="/contact">Get in touch</TextLink></div><div><p className="public-kicker">A CONVERSATION STARTS HERE</p><a href="mailto:info@bramblesandpetals.co.uk">info@bramblesandpetals.co.uk</a><p>Based in Southampton, creating wedding, funeral and event flowers across Hampshire. Consultations by arrangement.</p><Link href="/client-studio">Your Client Studio →</Link></div></div><div className="public-footer-bottom"><span>© {new Date().getFullYear()} Bramble &amp; Petal</span><nav aria-label="Footer navigation"><Link href="/our-studio">Our studio</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link></nav></div></footer>; }
export function PublicPage({ children, className = '' }: { children: ReactNode; className?: string }) { return <div className={`public-site ${className}`}><a className="public-skip" href="#main-content">Skip to content</a><StructuredData value={businessSchema} /><PublicHeader /><main id="main-content">{children}</main><PublicFooter /></div>; }
export function ConsultationCTA({ occasion = '', children = 'Start your consultation' }: { occasion?: string; children?: ReactNode }) { return <Link className="public-button" href={`/client-studio${occasion ? `?occasion=${encodeURIComponent(occasion)}` : ''}`}>{children}<Arrow /></Link>; }
