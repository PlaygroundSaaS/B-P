import { pageMetadata } from '@/lib/site-seo';
import type { Metadata } from 'next';
import EnquiryForm from '../enquiry-form';
import { PublicPage } from '../public/components';
export const metadata = pageMetadata('/contact');
export default async function Page({searchParams}:{searchParams:Promise<{occasion?:string}>}) {
 const params=await searchParams;
 return <PublicPage><section className="public-enquire public-wrap public-contact-page"><div><p className="public-kicker">LET’S BEGIN</p><h1>Tell us what<br/>you’re planning.</h1><p className="public-copy">A date, a place, a favourite flower. Share what you know; we’ll explore the rest together.</p><a className="public-email" href="mailto:info@bramblesandpetals.co.uk">info@bramblesandpetals.co.uk</a><p className="public-copy">Based in Southampton, we create wedding, funeral and event flowers across Hampshire. Your enquiry goes directly to our studio. Consultations, availability and delivery details are confirmed with you personally.</p></div><EnquiryForm initialOccasion={params.occasion}/></section></PublicPage>;
}
