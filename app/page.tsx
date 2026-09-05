import Image from 'next/image';
import EnquiryForm from './enquiry-form';
import PublicHeader from './public-header';
import weddingStyles from './wedding-gallery.module.css';

const weddingImages = [
  { src: '/assets/weddings/wedding-02.jpg', alt: 'Two pastel floral arrangements on stone plinths framing a wedding ceremony table beneath an arched window', label: 'The ceremony, ready for you' },
  { src: '/assets/weddings/wedding-03.jpg', alt: 'A wedding arrangement of green hydrangeas, pale yellow roses, white flowers and lilac stems', label: 'Soft colour, natural texture' },
  { src: '/assets/weddings/wedding-04.jpg', alt: 'A florist placing the finishing touches on wedding ceremony flowers beside a tall window', label: 'Bringing the setting together' },
  { src: '/assets/weddings/wedding-05.jpg', alt: 'A florist arranging pastel wedding flowers on a stone pedestal in a sunlit room', label: 'Every stem, carefully placed' },
  { src: '/assets/weddings/wedding-07.jpg', alt: 'A florist carrying a large wedding flower arrangement towards the venue', label: 'From our studio to your day' },
  { src: '/assets/weddings/wedding-09.jpg', alt: 'A florist carrying green, white and pale yellow wedding flowers outside a brick venue', label: 'Flowers arriving with care' },
];

const recentWork = [
  { src: '/assets/studio-work-4.jpg', alt: 'Pastel yellow and lilac flowers arranged in the studio', label: 'Season-led colour' },
  { src: '/assets/studio-work-2.jpg', alt: 'A natural white bouquet with eucalyptus', label: 'Wild white and green' },
  { src: '/assets/studio-work-6.jpg', alt: 'Pink and white hand-tied bouquet ready to give', label: 'Gathered to give' },
  { src: '/assets/bouquet-03.jpg', alt: 'A warm autumnal bouquet held in front of the florist', label: 'Rich autumn texture' },
];

const services = [
  { number: '01', title: 'Weddings', copy: 'Personal flowers, ceremony designs, table flowers and installations shaped around your day.' },
  { number: '02', title: 'Sympathy', copy: 'Thoughtful tributes, sprays and farewell flowers created with sensitivity and care.' },
  { number: '03', title: 'Corporate', copy: 'Flowers for events, launches, workplaces and brand moments, planned from setup to collection.' },
  { number: '04', title: 'Bouquets', copy: 'Seasonal, hand-tied flowers for birthdays, thanks and the moments that deserve something special.' },
];

export default function Home() {
  return (
    <div className="bp-site">
      <a className="bp-skip-link" href="#main-content">Skip to content</a>
      <header className="bp-hero" id="top">
        <PublicHeader />
        <div className="bp-hero-shade" />
        <div className="bp-hero-copy">
          <p className="bp-kicker bp-kicker--light">INDEPENDENT FLORAL STUDIO</p>
          <h1>Flowers that feel<br />entirely <em>yours.</em></h1>
          <p className="bp-hero-intro">Seasonal, characterful flowers for weddings, farewells, celebrations and everyday moments.</p>
          <div className="bp-actions">
            <a className="bp-button bp-button--light" href="#enquire">Start an enquiry</a>
            <a className="bp-text-link bp-text-link--light" href="#work">Explore our work <span aria-hidden="true">↘</span></a>
          </div>
        </div>
        <p className="bp-hero-note">Bramble &amp; Petal · Florist Studio</p>
      </header>

      <main id="main-content">
        <section className="bp-intro" id="about">
          <div className="bp-intro-copy">
            <p className="bp-kicker">THOUGHTFUL FLORAL DESIGN</p>
            <h2>Made for the moment,<br /><em>never from a template.</em></h2>
            <p className="bp-lede">We create distinctive floral work with a natural, garden-led feel. Every design begins with the people, place and season behind it.</p>
            <a className="bp-text-link" href="#studio">Meet Bramble &amp; Petal <span aria-hidden="true">→</span></a>
          </div>
          <figure className="bp-intro-image bp-image-reveal">
            <Image src="/assets/bouquet-04.jpg" alt="A peach, blush and cream Bramble and Petal bouquet" fill sizes="(max-width: 760px) 100vw, 50vw" />
            <figcaption>Flowers gathered with colour, texture and movement in mind.</figcaption>
          </figure>
        </section>

        <section className="bp-service-section" id="services" aria-labelledby="services-title">
          <div className="bp-section-heading">
            <div><p className="bp-kicker">HOW WE CAN HELP</p><h2 id="services-title">Flowers for the moments<br />that <em>matter most.</em></h2></div>
            <p>From one beautifully gathered bouquet to a complete event, the process stays personal, considered and clear.</p>
          </div>
          <div className="bp-service-list">
            {services.map(service => <article key={service.title}><span>{service.number}</span><h3>{service.title}</h3><p>{service.copy}</p><a href="#enquire" aria-label={`Enquire about ${service.title.toLowerCase()}`}>Enquire <span aria-hidden="true">→</span></a></article>)}
          </div>
        </section>

        <section className="bp-consultation" id="studio">
          <div className="bp-consultation-image bp-image-reveal">
            <Image src="/assets/studio-consultations.jpg" alt="The warm Bramble and Petal flower studio consultation space" fill sizes="(max-width: 760px) 100vw, 55vw" />
          </div>
          <div className="bp-consultation-copy">
            <p className="bp-kicker">VISIT THE FLOWER STUDIO</p>
            <h2>A calm place to<br /><em>talk through every detail.</em></h2>
            <p>Wedding, funeral and corporate consultations can be held in the flower studio — a relaxed, private space to share ideas, look through references and shape the plan together.</p>
            <ul><li>Wedding flowers and styling</li><li>Funeral tributes and family flowers</li><li>Corporate events and installations</li></ul>
            <a className="bp-button" href="#enquire">Arrange a consultation</a>
          </div>
        </section>

        <section className="bp-work" id="work" aria-labelledby="work-title">
          <div className="bp-section-heading">
            <div><p className="bp-kicker">FRESH FROM THE STUDIO</p><h2 id="work-title">A little of what<br />we&apos;ve been <em>making.</em></h2></div>
            <p>Real flowers made in the Bramble &amp; Petal studio — full of the colour and character of the season.</p>
          </div>
          <div className="bp-work-grid">
            {recentWork.map((work, index) => <figure className={index === 0 ? 'bp-work-feature' : ''} key={work.src}><Image src={work.src} alt={work.alt} fill sizes={index === 0 ? '(max-width: 760px) 86vw, 46vw' : '(max-width: 760px) 78vw, 24vw'} /><figcaption><span>0{index + 1}</span>{work.label}</figcaption></figure>)}
          </div>
        </section>

        <section className={weddingStyles.section} id="weddings" aria-labelledby="weddings-title">
          <div className="bp-section-heading">
            <div><p className="bp-kicker">WEDDING FLOWERS</p><h2 id="weddings-title">A day made<br /><em>beautifully yours.</em></h2></div>
            <p>From the flowers arriving to the final stems in place, a glimpse of the care behind our wedding designs.</p>
          </div>
          <div className={weddingStyles.grid}>
            {weddingImages.map(photo => (
              <figure className={weddingStyles.photo} key={photo.src}>
                <Image src={photo.src} alt={photo.alt} width={1536} height={2048} sizes="(max-width: 600px) calc(100vw - 48px), (max-width: 1020px) 43vw, (max-width: 1500px) 29vw, 428px" />
                <figcaption>{photo.label}</figcaption>
              </figure>
            ))}
          </div>
          <div className={weddingStyles.action}><a className="bp-text-link" href="#enquire">Talk to us about your wedding <span aria-hidden="true">→</span></a></div>
        </section>

        <section className="bp-sympathy" id="sympathy">
          <div className="bp-sympathy-copy">
            <p className="bp-kicker">SYMPATHY FLOWERS</p>
            <h2>Flowers to remember,<br /><em>honour and celebrate.</em></h2>
            <p>At a difficult time, flowers can say what words cannot. We create personal tributes, sprays, wreaths and farewell arrangements with sensitivity and attention to meaningful detail.</p>
            <a className="bp-text-link" href="#enquire">Arrange sympathy flowers <span aria-hidden="true">→</span></a>
          </div>
          <div className="bp-sympathy-images">
            <figure><Image src="/assets/sympathy-tribute.jpg" alt="A floral funeral tribute and letter arrangement" fill sizes="(max-width: 760px) 82vw, 32vw" /><figcaption>Personal farewell tributes</figcaption></figure>
            <figure><Image src="/assets/sympathy-spray.jpg" alt="A natural white and green floral spray" fill sizes="(max-width: 760px) 82vw, 32vw" /><figcaption>Natural funeral sprays</figcaption></figure>
            <figure><Image src="/assets/sympathy-making.jpg" alt="Bramble and Petal florists creating a white and green funeral tribute" fill sizes="(max-width: 760px) 82vw, 32vw" /><figcaption>Made with care, by hand</figcaption></figure>
          </div>
        </section>

        <section className="bp-process" aria-labelledby="process-title">
          <div className="bp-section-heading bp-section-heading--light"><div><p className="bp-kicker bp-kicker--light">OUR APPROACH</p><h2 id="process-title">From first thought<br />to <em>final flourish.</em></h2></div><p>A considered process that keeps the experience as lovely and unhurried as the flowers themselves.</p></div>
          <ol>
            <li><span>01</span><div><h3>Tell us your story</h3><p>Share the occasion, the atmosphere and anything that matters to you.</p></div></li>
            <li><span>02</span><div><h3>Shape the details</h3><p>We explore colour, season, scale and practical requirements together.</p></div></li>
            <li><span>03</span><div><h3>Bring it to life</h3><p>Every stem is prepared and placed with care for the finished moment.</p></div></li>
          </ol>
        </section>

        <section className="bp-enquire" id="enquire">
          <div className="bp-enquire-copy">
            <p className="bp-kicker">START A CONVERSATION</p>
            <h2>Tell us what<br />you&apos;re <em>imagining.</em></h2>
            <p>Choose your occasion and share the details you already know. It is completely fine if some things are still undecided.</p>
            <div className="bp-contact-note"><span>Prefer email?</span><a href="mailto:info@bramblesandpetals.co.uk">info@bramblesandpetals.co.uk</a></div>
          </div>
          <EnquiryForm />
        </section>
      </main>

      <footer className="bp-footer" id="contact">
        <div className="bp-footer-brand"><Image src="/assets/brand-logo.png" alt="Bramble and Petal Florist Studio" width={158} height={108} /><p>Thoughtful, seasonal flowers made with feeling.</p></div>
        <div><p className="bp-kicker">EXPLORE</p><a href="#about">About</a><a href="#services">Services</a><a href="#work">Our work</a><a href="#weddings">Weddings</a><a href="#enquire">Enquire</a></div>
        <div><p className="bp-kicker">GET IN TOUCH</p><a href="mailto:info@bramblesandpetals.co.uk">info@bramblesandpetals.co.uk</a><span>Studio consultations by arrangement</span></div>
        <div className="bp-footer-bottom"><span>© {new Date().getFullYear()} Bramble &amp; Petal</span><a href="/studio">Studio Hub</a></div>
      </footer>
    </div>
  );
}
