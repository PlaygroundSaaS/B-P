import Link from 'next/link';

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-hero" id="top">
        <nav className="landing-nav" aria-label="Main navigation">
          <a className="landing-brand" href="#top">
            Bramble<br /><span>&amp; Petal</span><small>FLORAL STUDIO</small>
          </a>
          <div className="landing-links">
            <a href="#top">Home</a><a href="#about">About</a><a href="#services">Services</a>
            <a href="#gallery">Gallery</a><a href="#enquire">Enquire</a><a href="#contact">Contact</a>
          </div>
          <Link className="landing-account" href="/studio"><span>♙</span> Log into<br />flower studio</Link>
        </nav>
        <div className="landing-hero-copy">
          <div className="landing-wordmark" aria-label="Bramble and Petal Florist Studio">
            <span>Bramble &amp; Petal</span><small>FLORIST STUDIO</small>
          </div>
          <i />
          <em>Where flowers tell your story</em>
          <a className="landing-button" href="#services">Discover our work</a>
        </div>
      </header>

      <main>
        <section className="landing-intro" id="about">
          <div>
            <p className="landing-eyebrow">THOUGHTFUL FLORAL DESIGN</p>
            <h1>Thoughtful flowers<br />for life&apos;s most<br />beautiful moments.</h1>
            <p>We create distinctive floral arrangements for weddings, events and everyday celebrations.</p>
            <a className="landing-text-link" href="#gallery">About Bramble &amp; Petal</a>
          </div>
          <img src="https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&amp;fit=crop&amp;w=950&amp;q=85" alt="Delicate seasonal flower arrangement" />
        </section>

        <section className="landing-values" aria-label="Our values">
          <div><b>❉</b><strong>Bespoke designs</strong><span>Tailored to you</span></div>
          <div><b>❀</b><strong>Fresh &amp; seasonal</strong><span>Sourced with care</span></div>
          <div><b>♧</b><strong>Sustainable</strong><span>Beautifully mindful</span></div>
          <div><b>♡</b><strong>Made with love</strong><span>Every time</span></div>
        </section>

        <section className="landing-services" id="services">
          <p className="landing-eyebrow">OUR SERVICES</p>
          <h2>Flowers for every occasion</h2>
          <div className="landing-cards" id="gallery">
            <a className="landing-card wedding" href="#enquire"><span>Weddings<small>View more</small></span></a>
            <a className="landing-card events" href="#enquire"><span>Events<small>View more</small></span></a>
            <a className="landing-card bouquets" href="#enquire"><span>Bouquets<small>View more</small></span></a>
            <a className="landing-card sympathy" href="#enquire"><span>Sympathy<small>View more</small></span></a>
          </div>
        </section>

        <section className="landing-enquire" id="enquire">
          <div>
            <p className="landing-eyebrow">LET&apos;S CREATE SOMETHING BEAUTIFUL</p>
            <h2>Start your floral enquiry</h2>
            <p>Tell us a little about your flowers, event or occasion and we&apos;ll be in touch.</p>
          </div>
          <form action="mailto:info@bramblesandpetals.co.uk" method="post" encType="text/plain">
            <input name="name" placeholder="Your name" required />
            <input name="email" type="email" placeholder="Email address" required />
            <select name="occasion" defaultValue="Wedding"><option>Wedding</option><option>Funeral flowers</option><option>Corporate event</option><option>Everyday flowers</option><option>Other</option></select>
            <textarea name="message" placeholder="Tell us what you have in mind" required />
            <button className="landing-button" type="submit">Send enquiry</button>
          </form>
        </section>
      </main>
      <footer className="landing-footer" id="contact"><p>Bramble &amp; Petal Floral Studio</p><a href="mailto:info@bramblesandpetals.co.uk">info@bramblesandpetals.co.uk</a></footer>
    </div>
  );
}

