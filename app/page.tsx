import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="landing">
      <header className="landing-hero" id="top">
        <nav className="landing-nav" aria-label="Main navigation">
          <a className="landing-brand" href="#top">
            <Image className="landing-brand-mark" src="/assets/brand-logo.png" alt="Bramble and Petal Florist Studio" width={152} height={104} priority />
          </a>
          <div className="landing-links">
            <a href="#top">Home</a><a href="#about">About</a><a href="#services">Services</a>
            <a href="#gallery">Gallery</a><a href="#enquire">Enquire</a><a href="#contact">Contact</a>
          </div>
          <Link className="landing-account" href="/studio"><span aria-hidden="true">✾</span><b>Studio Hub</b><small>Staff sign in</small></Link>
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
          <div className="landing-cards">
            <a className="landing-card wedding" href="#enquire"><span>Weddings<small>View more</small></span></a>
            <a className="landing-card events" href="#enquire"><span>Events<small>View more</small></span></a>
            <a className="landing-card bouquets" href="#bouquets"><span>Bouquets<small>View more</small></span></a>
            <a className="landing-card sympathy" href="#sympathy"><span>Sympathy<small>View more</small></span></a>
          </div>
        </section>

        <section className="landing-bouquets" id="bouquets">
          <div className="landing-section-heading">
            <div><p className="landing-eyebrow">HAND-TIED BOUQUETS</p><h2>Beautiful flowers, gathered just for them</h2></div>
            <p>Thoughtfully made bouquets for birthdays, thank-yous, celebrations and the days that simply call for flowers.</p>
          </div>
          <div className="landing-bouquet-grid">
            <figure className="bouquet-hero"><Image src="/assets/bouquet-01.jpg" alt="Soft pink and cream bouquet held by a florist" fill sizes="(max-width: 700px) 100vw, 44vw" /><figcaption>Soft and seasonal</figcaption></figure>
            <figure><Image src="/assets/bouquet-02.jpg" alt="Lilac, white rose and lily bouquet" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption>Pastel favourites</figcaption></figure>
            <figure><Image src="/assets/bouquet-03.jpg" alt="Autumn bouquet with warm orange flowers" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption>Autumn colour</figcaption></figure>
            <figure><Image src="/assets/bouquet-04.jpg" alt="Peach and blush rose bouquet" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption>Peach and blush</figcaption></figure>
            <figure><Image src="/assets/bouquet-05.jpg" alt="Bright mixed seasonal bouquet" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption>Bright and joyful</figcaption></figure>
          </div>
          <a className="landing-text-link landing-bouquet-link" href="#enquire">Order a bespoke bouquet</a>
        </section>

        <section className="landing-recent-work">
          <div className="landing-section-heading">
            <div><p className="landing-eyebrow">FRESH FROM THE STUDIO</p><h2>Every stem has its moment</h2></div>
            <p>A little look at the flowers, colour and character moving through the studio lately.</p>
          </div>
          <div className="landing-recent-grid">
            <figure><Image src="/assets/studio-work-1.jpg" alt="Rich red roses gathered in a wicker basket" fill sizes="(max-width: 700px) 72vw, 23vw" /><figcaption>Classic red roses</figcaption></figure>
            <figure><Image src="/assets/studio-work-2.jpg" alt="A natural white bouquet with eucalyptus" fill sizes="(max-width: 700px) 72vw, 23vw" /><figcaption>Wild white and green</figcaption></figure>
            <figure><Image src="/assets/studio-work-3.jpg" alt="Soft pink tulips hanging in the studio" fill sizes="(max-width: 700px) 72vw, 23vw" /><figcaption>Spring tulips</figcaption></figure>
            <figure><Image src="/assets/studio-work-4.jpg" alt="Pastel yellow and lilac flowers arranged around a table" fill sizes="(max-width: 700px) 72vw, 23vw" /><figcaption>Colour-led details</figcaption></figure>
            <figure><Image src="/assets/studio-work-5.jpg" alt="Fresh pink and white seasonal flowers in the studio" fill sizes="(max-width: 700px) 72vw, 23vw" /><figcaption>Fresh from market</figcaption></figure>
            <figure><Image src="/assets/studio-work-6.jpg" alt="Pink and white hand-tied bouquet ready to give" fill sizes="(max-width: 700px) 72vw, 23vw" /><figcaption>Ready to give</figcaption></figure>
          </div>
        </section>

        <section className="landing-sympathy" id="sympathy">
          <div className="landing-sympathy-copy">
            <p className="landing-eyebrow">SYMPATHY FLOWERS</p>
            <h2>Flowers to remember, honour and celebrate a life.</h2>
            <p>At a difficult time, flowers can say what words cannot. We create personal funeral tributes, sprays, wreaths and farewell arrangements with care, sensitivity and attention to every meaningful detail.</p>
            <a className="landing-text-link" href="#enquire">Arrange sympathy flowers</a>
          </div>
          <div className="landing-sympathy-images">
            <figure><img src="/assets/sympathy-tribute.jpg" alt="A floral funeral tribute and letter arrangement" /><figcaption>Personal farewell tributes</figcaption></figure>
            <figure><img src="/assets/sympathy-spray.jpg" alt="A natural white and green floral spray" /><figcaption>Natural funeral sprays</figcaption></figure>
            <figure><img src="/assets/sympathy-making.jpg" alt="Bramble and Petal florists creating a white and green funeral tribute" /><figcaption>Made with care, by hand</figcaption></figure>
          </div>
        </section>

        <section className="landing-portfolio" id="gallery">
          <div className="landing-section-heading">
            <div><p className="landing-eyebrow">A SELECTION OF OUR WORK</p><h2>Flowers with a sense of place</h2></div>
            <p>From a single gathered bouquet to an entire room in bloom, every design is made around the people, season and setting.</p>
          </div>
          <div className="landing-gallery-grid">
            <figure className="gallery-tall"><Image src="/assets/bouquet-06.jpg" alt="Gift-boxed bouquets ready to give" fill sizes="(max-width: 700px) 50vw, 38vw" /><figcaption><span>01</span> Flowers made for giving</figcaption></figure>
            <figure><Image src="/assets/bouquet-07.jpg" alt="A pink bouquet in front of the flower stand" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption><span>02</span> Fresh from the flower stand</figcaption></figure>
            <figure><Image src="/assets/bouquet-08.jpg" alt="A white floral arrangement in a glass vase" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption><span>03</span> A thoughtful thank-you</figcaption></figure>
            <figure><Image src="/assets/bouquet-09.jpg" alt="Yellow and white rose bouquet with daisies" fill sizes="(max-width: 700px) 50vw, 28vw" /><figcaption><span>04</span> Sunshine in a bouquet</figcaption></figure>
            <figure className="gallery-wide"><Image src="/assets/bouquet-10.jpg" alt="A white lily bouquet wrapped in kraft paper" fill sizes="(max-width: 700px) 100vw, 57vw" /><figcaption><span>05</span> Timeless lilies and delicate details</figcaption></figure>
          </div>
        </section>

        <section className="landing-story">
          <div className="landing-story-image"><img src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1100&q=85" alt="Natural flowers and foliage" /></div>
          <div className="landing-story-copy">
            <p className="landing-eyebrow">THE STUDIO</p>
            <h2>Flowers should feel like they belong to your story.</h2>
            <p>Bramble &amp; Petal is a floral studio drawn to quiet beauty, changing seasons and the thoughtful details that make an occasion feel entirely personal.</p>
            <p>We work closely with our clients from first ideas to final stem, creating flowers that are generous, characterful and made to be remembered.</p>
            <a className="landing-text-link" href="#enquire">Meet with the studio</a>
          </div>
        </section>

        <section className="landing-process">
          <p className="landing-eyebrow">OUR APPROACH</p><h2>From first thought to final flourish</h2>
          <div>
            <article><b>01</b><h3>Begin with your story</h3><p>Tell us about the moment, the people and the feeling you want to create.</p></article>
            <article><b>02</b><h3>Shape the details</h3><p>We build a seasonal floral direction, thoughtful proposal and clear plan around you.</p></article>
            <article><b>03</b><h3>Bring it beautifully to life</h3><p>On the day, every stem is placed with care so you can simply enjoy the occasion.</p></article>
          </div>
        </section>

        <section className="landing-quote"><p>“The flowers felt as though they had always belonged there — wild, elegant and completely us.”</p><span>— A Bramble &amp; Petal couple</span></section>

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

