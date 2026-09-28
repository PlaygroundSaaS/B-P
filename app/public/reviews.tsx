'use client';
import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import ClampedText from './clamped-text';
import Dialog from '../dialog';
import type { PublicReview as Review } from '@/lib/public-reviews';
import { reviewPhotoUrl } from '@/lib/review-validation';
// Photos the client attached to their review; tapping one opens it full size.
function ReviewPhotos({review}:{review:Review}){
 const [selected,setSelected]=useState<number|null>(null),photos=review.photos??[];
 if(!photos.length)return null;
 const alt=(index:number)=>`Photo ${index+1} shared by ${review.public_name}`,step=(by:number)=>setSelected(current=>current===null?null:(current+by+photos.length)%photos.length);
 return <><div className="public-review-photos">{photos.map((photo,index)=><button type="button" key={photo} onClick={()=>setSelected(index)} aria-label={`Enlarge photo ${index+1} of ${photos.length} from ${review.public_name}`}><Image src={reviewPhotoUrl(review.id,photo)} alt={alt(index)} width={240} height={240} sizes="96px"/></button>)}</div>
 {selected!==null&&<Dialog className="wedding-lightbox" label={`Photos from ${review.public_name}’s review`} onClose={()=>setSelected(null)}><div className="wedding-lightbox-content" onKeyDown={event=>{if(event.key==='ArrowRight')step(1);if(event.key==='ArrowLeft')step(-1);}}><button className="gallery-close" aria-label="Close photo" onClick={()=>setSelected(null)}>Close ×</button><Image src={reviewPhotoUrl(review.id,photos[selected])} alt={alt(selected)} width={1600} height={1200} sizes="(max-width: 760px) 90vw, 70vw"/><div className="gallery-controls">{photos.length>1&&<button aria-label="Previous photo" onClick={()=>step(-1)}>←</button>}<p aria-live="polite">{photos.length>1?`${selected+1} / ${photos.length} · `:''}{review.public_name}</p>{photos.length>1&&<button aria-label="Next photo" onClick={()=>step(1)}>→</button>}</div></div></Dialog>}</>;
}
function ReviewCard({review}:{review:Review}){
 const [open,setOpen]=useState(false),fullId=useId();
 const stars=<div aria-label={`${review.rating} out of 5 stars`} className="public-review-stars">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div>;
 const caption=<figcaption>{review.public_name}<span>{review.occasion}</span></figcaption>;
 if(!review.highlight)return <figure>{stars}<ClampedText text={review.review_text} lines={6}/><ReviewPhotos review={review}/>{caption}</figure>;
 return <figure className="has-highlight">{stars}<blockquote className="public-review-highlight">“{review.highlight}”</blockquote><div className="public-review-full" id={fullId} hidden={!open}>{review.review_text}</div><button type="button" className="public-review-toggle" aria-expanded={open} aria-controls={fullId} onClick={()=>setOpen(!open)}>{open?'Show less':'Read full review'}</button><ReviewPhotos review={review}/>{caption}</figure>;
}
export default function ClientReviews({initialReviews=[]}:{initialReviews?:Review[]}){
 const [reviews,setReviews]=useState<Review[]>(initialReviews);const [status,setStatus]=useState(initialReviews.length?'ready':'loading');const [shown,setShown]=useState(6);
 useEffect(()=>{const controller=new AbortController();fetch('/api/reviews',{signal:controller.signal,cache:'no-store'}).then(async response=>{if(!response.ok)throw new Error();const data=await response.json();setReviews(data.reviews);setStatus('ready');}).catch(()=>{if(!controller.signal.aborted&&!initialReviews.length)setStatus('error');});return()=>controller.abort();},[]);
 return <section className="public-reviews public-wrap" id="reviews"><p className="public-kicker">FROM OUR CLIENTS</p><h2>In their own words.</h2>{reviews.length?<><div className="public-review-grid">{reviews.slice(0,shown).map(review=><ReviewCard key={review.id} review={review}/>)}</div>{shown<reviews.length&&<button className="public-button" onClick={()=>setShown(shown+6)}>Read more reviews</button>}</>:<p className="public-copy">{status==='loading'?'Loading client reviews…':status==='error'?'Client reviews are temporarily unavailable.': 'A space for experiences shared by our clients. If we’ve created flowers for you, ask the studio for your personal review invitation.'}</p>}</section>;
}
