import ServiceFAQs from './service-faqs';
import { serviceSchema, type PublicPath } from '@/lib/site-seo';
import { Breadcrumbs, StructuredData } from './seo';
import Link from 'next/link';
import type { SectionPhotos } from '@/lib/site-photos';
import { PublicPage, SitePhotoFrame, ConsultationCTA, TextLink } from './components';
export type ServiceContent = { title: string; label: string; intro: string; occasion: string; sections: { title: string; text: string }[]; closing: string };
// photos come from the page's section in the Studio's Website photos: the top
// of the page first, then one beside each section. Any of them can be empty.
export default function ServicePage({ content, photos, children, path }: { content: ServiceContent; photos: SectionPhotos; children?: React.ReactNode; path: PublicPath }) {
 const [top = null, ...beside] = photos;
 return <PublicPage><Breadcrumbs path={path} />{path !== '/our-studio' && <StructuredData value={serviceSchema(path)} />}<section className={`public-service-hero ${top ? '' : 'public-service-hero-type'}`}><div className="public-section-copy"><p className="public-kicker">{content.label}</p><h1>{content.title}</h1><p className="public-copy">{content.intro}</p><div className="public-page-actions"><ConsultationCTA occasion={content.occasion}>Start a conversation</ConsultationCTA><TextLink href={`/contact?occasion=${encodeURIComponent(content.occasion)}`}>Enquire</TextLink></div></div>{top ? <SitePhotoFrame photo={top} preload /> : <div className="public-designed-panel" aria-label="Bramble and Petal floral design"><span>B &amp; P</span><p>Considered flowers.<br/><em>A lasting impression.</em></p><small>DESIGNED AROUND YOUR SPACE</small></div>}</section><div className="public-service-sections public-wrap">{content.sections.map((section,index)=><section key={section.title} className={`public-service-section ${beside[index] ? 'with-photo' : ''}`}><div><p className="public-kicker">0{index+1}</p><h2>{section.title}</h2><p className="public-copy">{section.text}</p></div><SitePhotoFrame photo={beside[index] ?? null} /></section>)}</div>{children}<ServiceFAQs path={path} /><section className="public-page-closing public-wrap"><p className="public-kicker">LET’S BEGIN</p><h2>{content.closing}</h2><ConsultationCTA occasion={content.occasion}/><p>Already invited? <Link href="/client">Open your private Client Studio →</Link></p></section></PublicPage>;
}
