import Link from 'next/link';

export default function Home() {
  return <main className="site-hero"><nav className="site-nav"><span className="site-brand">Bramble &amp; Petal<small>FLORIST STUDIO</small></span><Link className="site-link" href="/studio">Enter Studio Hub</Link></nav><section><p className="eyebrow">THOUGHTFUL FLORAL DESIGN</p><h1>Where flowers<br />tell your story.</h1><p>Weddings, events and everyday floral moments, made with care.</p><Link className="button" href="/studio">Discover the Studio</Link></section></main>;
}

