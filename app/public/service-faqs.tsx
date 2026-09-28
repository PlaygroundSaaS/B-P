import Link from 'next/link';
import type { PublicPath } from '@/lib/site-seo';
const questions: Partial<Record<PublicPath, [string, string][]>> = {
 '/weddings': [
  ['Do you create wedding flowers across Hampshire?', 'Yes. Bramble & Petal is based in Southampton and creates wedding flowers across the New Forest and Hampshire. Include your venue and date in your enquiry so we can confirm availability, delivery and setup arrangements.'],
  ['Do you provide wedding flowers in the New Forest?', 'Yes. We create wedding flowers for venues across the New Forest, including Lyndhurst, Brockenhurst, Lymington, Beaulieu and Ringwood. Tell us your venue and date, and we will confirm delivery and setup times with you and your venue.'],
  ['Which wedding arrangements can we discuss?', 'Your floral plan can include bridal and bridesmaid bouquets, buttonholes, flower crowns, ceremony arrangements and reception table flowers. Tell us which spaces and moments matter most, along with your colours and budget.'],
  ['How much will our wedding flowers cost?', 'Your proposal depends on the arrangements, quantities, flower choices and practical work involved. Share your priorities and a budget if you have one; we will prepare a personal proposal before you decide.'],
  ['Can I request particular flowers or colours?', 'Yes. Share your favourite flowers, colour palette and reference images. Flower availability changes with the season, so we will discuss suitable alternatives where a particular stem is unavailable.'],
 ],
 '/funerals': [
  ['Can you help with funeral flowers in Southampton, the New Forest and Hampshire?', 'Yes. Tell us the service date, location and the tribute you have in mind. We will confirm availability and delivery arrangements with you, including any details needed for the funeral director or venue.'],
  ['Can you deliver funeral flowers to a funeral director or church?', 'Yes. We deliver funeral flowers to funeral directors, churches and crematoria across Southampton, the New Forest and Hampshire. Share the service date, time and address, and we will confirm the delivery time with you.'],
  ['What kinds of funeral tribute can I request?', 'You can discuss sprays, wreaths, hearts, posies and personal tributes. A favourite flower, meaningful colour or message can help us create something that reflects the person being remembered.'],
  ['What information should I include in an enquiry?', 'Your name and contact details, the service date if known, delivery location, preferred tribute and budget are helpful. You do not need to have every detail decided before contacting the studio.'],
 ],
 '/corporate': [
  ['Do you provide event flowers throughout Hampshire?', 'Yes. We work with businesses and event clients across Southampton, the New Forest and Hampshire from our Southampton studio. Share the venue, date, spaces to be dressed and any brand colours so we can discuss the brief.'],
  ['Can we arrange regular flowers for a workplace?', 'Ask us about weekly, fortnightly or monthly arrangements for reception areas, offices, restaurants and hospitality spaces. The schedule, designs and delivery arrangements are agreed with you before booking.'],
  ['Can the proposal include installation and collection?', 'Tell us what is required at your venue. We will discuss access, placement, setup timing and collection where needed, and include agreed practical arrangements in your plan.'],
 ],
 '/flowers': [
  ['How do I order a bouquet?', 'Send an enquiry with the occasion, preferred colours, budget and date. We will confirm available flowers, the arrangement and collection or delivery details with you personally.'],
  ['Which areas do you deliver to?', 'We deliver across Southampton and the New Forest, including Totton, Lyndhurst, Brockenhurst and Lymington, and to nearby Hampshire towns such as Romsey, Eastleigh and Winchester. Include the delivery address and preferred date in your enquiry.'],
  ['Can you deliver my flowers?', 'Include the delivery area and preferred date in your enquiry. The studio will confirm whether delivery is available, along with timing and any delivery charge, before anything is booked.'],
  ['Can I arrange regular flowers for home or work?', 'Yes, ask about a regular arrangement. We will discuss your preferred style, budget and frequency, then agree collection or delivery arrangements together.'],
 ],
};
export default function ServiceFAQs({ path }: { path: PublicPath }) {
 const items = questions[path]; if (!items) return null;
 return <section className="public-service-faq public-wrap"><p className="public-kicker">PLANNING YOUR FLOWERS</p><h2>Your questions, answered.</h2>{items.map(([question, answer]) => <details key={question}><summary>{question}</summary><p className="public-copy">{answer}</p></details>)}<p className="public-copy">Ready to talk through the details? <Link href="/contact">Contact our Southampton studio</Link> or <Link href="/our-studio">meet Jade</Link>.</p></section>;
}
